/* Copyright 2012 Huygens ING
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
var falafel = require('falafel');
var fs = require('fs');

var CONSOLE_METHODS = [
    'assert',
    'clear',
    'count',
    'debug',
    'dir',
    'dirxml',
    'error',
    'exception',
    'error',
    'group',
    'groupEnd',
    'groupCollapsed',
    'info',
    'log',
    'memoryProfile',
    'memoryProfileEnd',
    'profile',
    'profileEnd',
    'table',
    'time',
    'timeEnd',
    'timeStamp',
    'trace',
    'warn'
];

function isConsoleLog(node, logOnly) {
  function isConsole(n) {
    return (n.name == 'console') || (n.object && n.object.name == 'window' && n.property.name == 'console'); 
  };
  function shouldMessWithMethod(method) {
    return method && (method.name == 'log' ||
                      (!logOnly && CONSOLE_METHODS.indexOf(method.name) != -1));
  };
  return node.type == 'CallExpression' && node.callee && node.callee.object && isConsole(node.callee.object) && shouldMessWithMethod(node.callee.property);
}

function cleanArg(arg) {
  var someNode = null;
  var n = falafel(arg, function(node) {
    someNode = node;
    node.__selfHasSideEffects = node.type == 'CallExpression' || node.type == 'UpdateExpression' ||
                                node.type == 'AssignmentExpression';
    node.__hasSideEffects = (node.__kidsWithSideEffects && node.__kidsWithSideEffects.length) ||
                            node.__selfHasSideEffects;
    if (node.parent) {
      if (!node.parent.__kidsWithSideEffects) {
        node.parent.__kidsWithSideEffects = []
        node.parent.__kidsWithoutSideEffects = []
      }
      if (node.__hasSideEffects) {
        node.parent.__kidsWithSideEffects.push(node);
      } else {
        node.parent.__kidsWithoutSideEffects.push(node);
      }
    }
  });
  var topNode = someNode;
  while (topNode.parent) {
    topNode = topNode.parent;
  }

  function cleanNodeWithPossibleKids(n) {
    if (n.__selfHasSideEffects) {
      var source = n.source();
      if (n.type == 'AssignmentExpression' || n.type == 'UpdateExpression') {
        source = '(' + source + ')';
      }
      return [source];
    }
    if (n.__kidsWithSideEffects && n.__kidsWithSideEffects.length) {
      return callSideEffectsButDoNothing(n.__kidsWithSideEffects, cleanNodeWithPossibleKids);
    }
    // Otherwise, nothin':
    return [];
  }
  return cleanNodeWithPossibleKids(topNode);
}

function updateNode(node) {
  var nodesToLeave = callSideEffectsButDoNothing(node.arguments, function(n) {
    return cleanArg(n.source());
  });

  if (nodesToLeave.length == 0) {
    node.update('0');
  } else {
    node.update('(' + nodesToLeave.join(' && 0) || (') + ' && 0)');
  }
}

function callSideEffectsButDoNothing(ary, fn) {
  var rv = [];
  for (var i = 0; i < ary.length; i++) {
    var newRv = fn(ary[i]);
    if (newRv.length) {
      rv = rv.concat(newRv);
    }
  }
  return rv;
}

module.exports = {
  removeLogs: function remLogs(inDesignator, outDesignator, logOnly) {
    var instream;

    var isStdOut = (outDesignator == 'stdout');

    if (inDesignator == 'stdin') {
      instream = process.stdin;
      instream.resume();
    } else {
      try {
        instream = fs.createReadStream(inDesignator);
      } catch (ex) {
        console.error("Error: could not read from:", inDesignator, "; exiting without doing anything.");
        process.exit(1);
      }
    }
    instream.setEncoding('utf8');

    var scriptdata = '';

    instream.on('data', function(str) { scriptdata += str; });
    instream.on('end', function() {
      var outputStr = falafel(scriptdata, function(node) {
        if (isConsoleLog(node, logOnly)) {
          updateNode(node);
        }
      });

      if (isStdOut) {
        process.stdout.write(outputStr.toString());
        process.exit(0);
      } else {
        process.nextTick(function() {
          fs.writeFile(outDesignator, outputStr.toString(), 'utf8', function() { console.log('Saved output as "' + outDesignator + '".'); });
        });
      }
    });
  }
}

