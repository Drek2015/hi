// Sprite art, taken from the reference images the player supplied (see tools/sprites/).
// Per image: which way the character faces in the source ('right', 'left' or 'front') and the
// character's standing height in that image's pixels, so every sprite is shown at the same size.
export const SPRITE_ART = {
  naruto_stand: { face: 'right', h: 51 },
  naruto_crouch: { face: 'left', h: 51 },
  naruto_sign: { face: 'front', h: 51 },
  naruto_punch: { face: 'right', h: 52 },
  naruto_kcm: { face: 'front', h: 70 },
  kakashi_stand: { face: 'front', h: 59 },
  kakashi_claw: { face: 'right', h: 59 },
  kakashi_sign: { face: 'right', h: 59 },
  kakashi_raikiri: { face: 'left', h: 60 },
  kakashi_chidori: { face: 'front', h: 138 },
  minato_flash: { face: 'right', h: 83 },
  minato_kunai: { face: 'left', h: 105 },
  minato_blue: { face: 'right', h: 54 },
  minato_rasengan: { face: 'right', h: 90 },
  madara_stand: { face: 'right', h: 92 },
  madara_gunbai: { face: 'front', h: 54 },
  momoshiki_stand: { face: 'front', h: 83 },
  momoshiki_form: { face: 'front', h: 75 },
  momoshiki_big: { face: 'front', h: 150 },
  goku_kame: { face: 'right', h: 44 },
  goku_ssj3: { face: 'right', h: 46 },
  goku_ssj_kame: { face: 'left', h: 56 },
  goku_ui_bomb: { face: 'left', h: 58 },
  goku_ui_up: { face: 'front', h: 46 },
  obito_tobi: { face: 'front', h: 56 },
  sasuke_cloak: { face: 'left', h: 58 },
  spiderman: { face: 'front', h: 27 },
  ironman: { face: 'right', h: 86 },
  cap: { face: 'front', h: 88 },
  thor: { face: 'right', h: 90 },
};

// Which picture each character shows for each kind of action. Slots: stand (idle, run, air),
// crouch (guard, charge, landing), sign (hand signs, channelled abilities), strike (attacks),
// rush (dashes and rushing abilities), beam (blasts), victory. Missing slots fall back to stand.
// `forms` and `skins` swap in other pictures for transformations and costumes.
export const CHAR_SPRITES = {
  naruto: {
    base: { stand: 'naruto_stand', crouch: 'naruto_crouch', sign: 'naruto_sign', strike: 'naruto_punch', rush: 'naruto_punch', beam: 'naruto_punch', victory: 'naruto_sign' },
    forms: { kcm: { all: 'naruto_kcm' }, klm: { all: 'naruto_kcm' }, sixpaths: { all: 'naruto_kcm' }, baryon: { all: 'naruto_kcm' } },
  },
  kakashi: {
    base: { stand: 'kakashi_stand', crouch: 'kakashi_sign', sign: 'kakashi_sign', strike: 'kakashi_claw', rush: 'kakashi_raikiri', beam: 'kakashi_chidori', victory: 'kakashi_stand' },
  },
  minato: {
    base: { stand: 'minato_flash', crouch: 'minato_blue', sign: 'minato_blue', strike: 'minato_kunai', rush: 'minato_flash', beam: 'minato_rasengan', victory: 'minato_flash' },
  },
  madara: {
    base: { stand: 'madara_stand', crouch: 'madara_stand', sign: 'madara_gunbai', strike: 'madara_gunbai', beam: 'madara_gunbai', victory: 'madara_stand' },
  },
  momoshiki: {
    base: { stand: 'momoshiki_stand' },
    forms: { fruit: { all: 'momoshiki_big' }, karma: { all: 'momoshiki_form' } },
  },
  goku: {
    base: { stand: 'goku_kame', crouch: 'goku_kame', strike: 'goku_ssj3', beam: 'goku_kame', rush: 'goku_ssj3' },
    forms: { ssj: { all: 'goku_ssj_kame' }, ssj2: { all: 'goku_ssj_kame' }, ssj3: { all: 'goku_ssj3' }, ssb: { all: 'goku_ssj_kame' }, ssg: { all: 'goku_ssj_kame' } },
    skins: { ultra: { stand: 'goku_ui_bomb', beam: 'goku_ui_bomb', sign: 'goku_ui_up', strike: 'goku_ui_bomb', victory: 'goku_ui_up' } },
  },
  obito: { base: { stand: 'obito_tobi' } },
  sasuke: { base: { stand: 'sasuke_cloak' } },
  spiderman: { base: { stand: 'spiderman' } },
  ironman: { base: { stand: 'ironman' } },
  cap: { base: { stand: 'cap' } },
  thor: { base: { stand: 'thor' } },
};
