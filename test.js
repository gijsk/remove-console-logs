var x = 'hello';

console.log(x);
if (console.error(y)) {
  document.getElementById('z').innerHTML = y;
}

console.log("This is a multiline expression " +
            withSideEffects() + " and stuff.");

function withSideEffects() {
  return "(side effects)";
}
