#!/usr/bin/env node

var esprima = require('esprima');

var args = process.argv.slice(2);

process.stdout.write(args.join(", "));
