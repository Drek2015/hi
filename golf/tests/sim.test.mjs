// Plays every hole with a strong bot to check each one is solvable near par.
import { WORLDS } from '../js/courses.js';
import { Course, DistanceField, makeBall, planShot, stepBall, shoot, PHYS } from '../js/sim.js';

let failures = 0;
for (const w of WORLDS) {
  w.holes.forEach((def, hi) => {
    const course = new Course(def);
    if (!course.start || !course.cup) { console.log(`FAIL ${w.id} #${hi + 1}: missing start or cup`); failures++; return; }
    const field = new DistanceField(course);
    const d0 = field.at(course.start.x, course.start.y);
    const runs = [];
    let planMs = 0;
    for (let run = 0; run < 3; run++) {
      const ball = makeBall(course);
      let t = run * 0.37, strokes = 0;
      while (!ball.sunk && strokes < 12) {
        const t0 = performance.now();
        const gen = planShot(course, field, ball, t, 0.85);
        let r; while (!(r = gen.next()).done); 
        planMs = Math.max(planMs, performance.now() - t0);
        shoot(ball, r.value.angle, r.value.power);
        strokes++;
        let steps = 0;
        while (ball.moving && steps < 2400) { stepBall(course, ball, t); t += PHYS.DT; steps++; }
        t += 1.0;
      }
      runs.push(ball.sunk ? strokes : 99);
    }
    const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
    const ok = Number.isFinite(d0) && avg <= def.par + 1.5;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${w.id.padEnd(9)} #${hi + 1} ${def.name.padEnd(20)} par ${def.par}  bot strokes ${runs.join(',')}  path ${d0.toFixed(1)}m  walls ${course.walls.length}  plan ${planMs.toFixed(0)}ms`);
  });
}
console.log(failures ? `\n${failures} hole(s) failed` : '\nall holes playable');
process.exit(failures ? 1 : 0);
