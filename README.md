What?
-----

This is just a small tool which parses your JS and replaces any `console.*` calls
with 0. It uses [falafel](https://github.com/substack/node-falafel) to walk the AST.
Falafel uses [esprima](https://github.com/ariya/esprima) to parse your JS.
Finally, [optimist](https://github.com/substack/optimist) is used for cli argument parsing.

How?
----

Just running `npm install -g remove-console-logs` should work.

