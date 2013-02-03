var x = 'hello';

console.log(x);
if (console.error(y)) {
  document.getElementById('z').innerHTML = y;
}

// Removes everything but the side-effect call.
console.log("This is a multiline expression " +
            withSideEffects() + " and stuff.");

console.log((x = "inline assignments are evil"));

// Try inline functions so we're sure we don't break those, either:
console.log((x = function() { callSomethingElse(); return "hahaha"; }));

console.log((function() { return "test!"; })());

// How about updates?
console.log(i--);

console.log("We're now at " + (n += 5) + "%!");

function withSideEffects() {
  return "(side effects)";
}
