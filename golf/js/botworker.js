// Plans rival shots off the main thread so the game never stutters.
import { WORLDS } from './courses.js';
import { Course, DistanceField, planShot } from './sim.js';

let course = null, field = null;
self.onmessage = e => {
  const m = e.data;
  if (m.type === 'hole') {
    course = new Course(WORLDS[m.world].holes[m.hole]);
    field = new DistanceField(course);
  } else if (m.type === 'plan' && course) {
    const gen = planShot(course, field, m.ball, m.t0, m.skill);
    let r;
    while (!(r = gen.next()).done);
    self.postMessage({ type: 'plan', id: m.id, angle: r.value.angle, power: r.value.power });
  }
};
