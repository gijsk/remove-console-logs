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
var util = require('util');

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
  }
  function shouldMessWithMethod(method) {
    return method && (method.name == 'log' ||
                      (!logOnly && CONSOLE_METHODS.indexOf(method.name) != -1));
  }
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
        node.parent.__kidsWithSideEffects = [];
        node.parent.__kidsWithoutSideEffects = [];
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
  var nodesToLeave = callSideEffectsButDoNothing(node['arguments'], function(n) {
    return cleanArg(n.source());
  });

  if (!nodesToLeave.length) {
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

var queuedFiles = 0, totalFileCount = 0;

var emitter = require('events').EventEmitter;
function LogRemover() {
  emitter.call(this);
}
util.inherits(LogRemover, emitter);

LogRemover.prototype.remove =
function remLogs(inDesignator, outDesignator, logOnly, batchMode, nonExplicit) {
  var self = this;
  function onInputError(ex, manualError) {
    if (!manualError) {
      queuedFiles--;
      totalFileCount--;
    }
    if (ex && ex.code == 'EISDIR') {
      self.emit('dirs', inDesignator);
      return;
    }
    var resultOfError = batchMode ? "skipping." : "exiting without doing anything.";
    console.error("Error: could not read from:", inDesignator, ";", resultOfError);
    if (!batchMode) {
      process.exit(1);
    }
  }
  var instream;


  if (inDesignator == 'stdin') {
    instream = process.stdin;
    instream.resume();
  } else if (batchMode && nonExplicit && inDesignator.indexOf('.js') == -1) {
    fs.stat(inDesignator, function(err, statInfo) {
      if (!err) {
        if (statInfo.isDirectory()) {
          self.emit('dirs', inDesignator);
        } else {
          console.error("Ignoring '" + inDesignator + "'.");
        }
      } else {
        console.error("Error trying to determine if '" + inDesignator + "' is a directory or not.");
      }
    });
    return;
  } else {
    try {
      instream = fs.createReadStream(inDesignator);
      instream.on('error', onInputError);
    } catch (ex) {
      onInputError(ex, true);
      return;
    }
  }

  processStream(instream, inDesignator, outDesignator, logOnly, batchMode, self);
};


function processStream(instream, inDesignator, outDesignator, logOnly, batchMode, self) {
  var isStdOut = outDesignator == 'stdout';
  instream.setEncoding('utf8');

  var scriptdata = '';
  queuedFiles++;
  totalFileCount++;

  instream.on('data', function(str) { scriptdata += str; });
  instream.on('end', function() {
    var outputStr;
    try {
      outputStr = falafel(scriptdata, function(node) {
        if (isConsoleLog(node, logOnly)) {
          updateNode(node);
        }
      });
    } catch (ex) {
      queuedFiles--;
      totalFileCount--;
      console.error("Error trying to process '" + inDesignator + "':", ex);
      return;
    }

    if (isStdOut) {
      process.stdout.write(outputStr.toString());
      if (!batchMode); {
        process.exit(0);
      }
    } else {
      process.nextTick(function() {
        fs.writeFile(outDesignator, outputStr.toString(), 'utf8', function() {
          if (!batchMode) {
            console.log('Saved output as "' + outDesignator + '".');
          } else {
            console.log('Processed "' + outDesignator + '".');
          }

          queuedFiles--;
          if (batchMode && queuedFiles === 0) {
            self.emit('finished', totalFileCount);
          }
        });
      });
    }
  });
}

module.exports = LogRemover;
