What?
-----

This is just a small tool which parses your JS and replaces any `console.*` calls
with 0. It uses [falafel](https://github.com/substack/node-falafel) to walk the AST.
Falafel uses [acorn](https://github.com/ternjs/acorn) to parse your JS.
Finally, [yargs](https://github.com/yargs/yargs) is used for cli argument parsing.

How do I get it?
----------------

Just running `npm install -g remove-console-logs` should work.


How do I use it?
----------------

See `remove-console-logs --help`.

