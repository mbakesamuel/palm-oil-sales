const isoDate = "2026-05-29";

const [ys, ms, ds] = isoDate.split("-").map((x) => Number.parseInt(x, 10));

console.log(ys);
console.log(ms);
console.log(ds);
