/* Original 6×6 pixel art for the macOS port. Also usable from Node tests. */
(function (root) {
  "use strict";
  const groups = {
    "太空漫游": {
      rocket: ["..rr..", ".rwwr.", ".wccw.", ".wwww.", "rwwwwr", ".oyyo."],
      saturn: ["......", "..yy..", ".yyyyc", "ccyyc.", ".ccc..", "......"],
      ufo: ["..cc..", ".cAAc.", "vvvvvv", ".vvvv.", "..yy..", ".y..y."],
      comet: [".....c", "....c.", ".y.cc.", "yyyc..", ".y....", "......"],
      astronaut: [".wwww.", "wwccww", "wccccw", "wwwwww", ".wrrw.", ".w..w."],
      galaxy: ["v....p", ".v.pp.", "..pp..", "..vv..", ".pp.v.", "p....v"],
      telescope: ["....cc", "...cc.", "..cc..", ".cc...", "..y...", ".y.y.."],
      planet: ["..bb..", ".bbgg.", "bbggbb", "bggbbb", ".bbbg.", "..bb.."]
    },
    "天气四季": {
      sunrise: ["......", "..yy..", ".yyyy.", "oooooo", "......", "bbbbbb"],
      cloud: ["......", "..ww..", ".wwww.", "wwwwww", "wwwwww", "......"],
      rain: ["..ww..", ".wwww.", "wwwwww", "......", ".b.b.b", "b.b.b."],
      snowflake: ["c.cc.c", ".cccc.", "cccccc", "cccccc", ".cccc.", "c.cc.c"],
      rainbow: [".rrrr.", "roooor", "oyyyyo", "yggggy", "gbbbbg", "bv..vb"],
      umbrella: ["..rr..", ".rrrr.", "rrrrrr", "..y...", "..y.y.", "...y.."],
      maple: ["..r...", "r.rr.r", "rrrrrr", ".rrrr.", "..rr..", "..n..."],
      mountain: ["...w..", "..www.", ".bwwbb", "bbabbb", "bbbbbb", "gggggg"]
    },
    "零食时间": {
      sushi: ["......", ".wwww.", "wwrrww", "wwrrww", ".ssss.", "......"],
      pizza: ["..yy..", "..yr..", ".yyyy.", ".yryy.", "yyyyry", "oooooo"],
      donut: [".pppp.", "ppyypp", "py..yp", "pp..pp", "ppyypp", ".oooo."],
      icecream: ["..pp..", ".pppp.", "pppppp", ".yyyy.", "..yy..", "..y..."],
      burger: [".yyyy.", "yyyyyy", "gggggg", "rrrrrr", "nnnnnn", ".yyyy."],
      cupcake: ["..r...", ".pppp.", "pppppp", ".yyyy.", ".yoyy.", "..yy.."],
      boba: ["...p..", "...p..", ".yyyy.", ".yppy.", ".y.py.", "..yy.."],
      onigiri: ["..ww..", ".wwww.", ".wwww.", "wwwwww", "wwssww", ".wssw."]
    },
    "日常小物": {
      camera: ["..ss..", ".sssss", "ssccss", "scAAcs", "ssccss", ".ssss."],
      gamepad: ["......", ".vvvv.", "vvvvvv", "v.yvpv", "vyyyvv", "vv..vv"],
      headphones: [".cccc.", "cc..cc", "c....c", "cc..cc", "cc..cc", "......"],
      hourglass: ["yyyyyy", ".y..y.", "..yy..", "..yy..", ".yyyy.", "yyyyyy"],
      key: [".yy...", "y..y..", "y..y..", ".yyyyy", "...y.y", "......"],
      envelope: ["......", "cccccc", "cw..wc", "ccwwcc", "cccccc", "......"],
      gift: [".p..p.", "..pp..", "yyppyy", "yyppyy", "pppppp", "yyppyy"],
      sprout: ["gg..gg", "gGggGg", ".gggg.", "..gg..", "..gg..", ".nnnn."]
    }
  };
  const names = {
    rocket:"小火箭", saturn:"土星", ufo:"飞碟", comet:"彗星", astronaut:"宇航员", galaxy:"星云", telescope:"望远镜", planet:"蓝色星球",
    sunrise:"日出", cloud:"云朵", rain:"下雨啦", snowflake:"雪花", rainbow:"彩虹", umbrella:"雨伞", maple:"枫叶", mountain:"雪山",
    sushi:"寿司", pizza:"披萨", donut:"甜甜圈", icecream:"冰淇淋", burger:"汉堡", cupcake:"纸杯蛋糕", boba:"珍珠奶茶", onigiri:"饭团",
    camera:"相机", gamepad:"游戏手柄", headphones:"耳机", hourglass:"沙漏", key:"钥匙", envelope:"信封", gift:"礼物", sprout:"小嫩芽"
  };
  const library = {groups, names, designs:Object.assign({}, ...Object.values(groups))};
  if (typeof module !== "undefined" && module.exports) module.exports = library;
  else root.YOGO_PATTERNS = library;
})(typeof globalThis !== "undefined" ? globalThis : this);
