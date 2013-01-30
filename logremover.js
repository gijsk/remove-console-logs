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
          node.update('0');
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
