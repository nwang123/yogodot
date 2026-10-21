/* Original 6×6 pixel art for the macOS port. Also usable from Node tests. */
(function (root) {
  "use strict";
  // Golden shaded coat: dark tips, honey gold, cream muzzle, jade eyes.
  const palette = {
    "h": [205, 145, 54],
    "H": [255, 218, 143],
    "i": [238, 185, 87],
    "I": [112, 78, 40],
    "q": [65, 222, 148],
    "Q": [255, 239, 198],
    "u": [235, 132, 147]
  };
  const groups = {
    "未来信号": {
      neoncore: [".cccc.", "cb..bc", "b.vv.b", "b.vv.b", "cb..bc", ".cccc."],
      cybervisor: [".vvvv.", "vccccv", "ccAAAc", "cAAAcc", "vccccv", ".vvvv."],
      quantumgate: ["cc..vv", "cA..Av", ".AccA.", ".AvvA.", "cA..Av", "cc..vv"],
      circuit: ["c...cc", "c.ccc.", "ccc...", "..c.cc", "ccc.c.", "c...cc"],
      hologrid: ["..cc..", ".c..c.", "cccccc", "b.bb.b", ".bbbb.", "vv..vv"],
      plasmahex: [".cccc.", "cvvvvc", "cv..vc", "cv..vc", "cvvvvc", ".cccc."],
      digitaleye: ["......", ".cccc.", "ccvvcc", "ccvvcc", ".cccc.", "......"],
      iondrive: ["c....c", ".cccc.", "..AA..", "..vv..", ".vvvv.", "v....v"],
      nexus: ["c.c..v", ".ccc.v", "ccAAcv", "vcAAcc", "v.ccc.", "v..c.c"],
      synthwave: ["..pp..", ".pppp.", "......", "vvvvvv", "b.bb.b", "cccccc"],
      starportal: ["v....c", ".v..c.", "..AA..", "..AA..", ".c..v.", "c....v"],
      cybercity: ["....c.", ".v..cv", ".v.ccv", "bvcAcv", "bvcccv", "cccccc"]
    },
    "金渐层猫咪": {
      goldenportrait: ["h....h", "iHiiHi", "HqHHqH", "HQuuQH", ".QIIQ.", "..QQ.."],
      goldenwink: ["h....h", "iHiiHi", "HqHHIH", "HQuuQH", ".QIIQ.", "..QQ.."],
      goldensleepy: ["h....h", "iHiiHi", "HIHHIH", "HQuuQH", ".QQQQ.", "..QQ.."],
      goldenloaf: ["h..h..", "iHHi..", "HqHqH.", "HQuQHi", ".HHHHi", "QQHHQQ"],
      goldenpawup: ["h..h.H", "iHHi.u", "HqHq.H", "HQuQHH", ".HHHH.", ".Q..Q."],
      goldenprofile: ["..h...", ".iHH..", ".HqHHu", ".HQQQ.", "iHHH..", "iQQQi."],
      goldenlove: ["h....h", "iHiiHi", "HqHHqH", "HQuuQH", ".p..p.", "..pp.."],
      goldenpaws: [".h..h.", ".H..H.", "H.HH.H", "HQQQQH", ".QuuQ.", "..HH.."]
    },
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
    neoncore:"霓虹核心", cybervisor:"赛博面罩", quantumgate:"量子之门", circuit:"光子电路", hologrid:"全息网格", plasmahex:"等离子环",
    digitaleye:"数字之眼", iondrive:"离子引擎", nexus:"神经节点", synthwave:"合成波日落", starportal:"星际传送门", cybercity:"赛博天际线",
    goldenportrait:"金渐层 · 正脸", goldenwink:"金渐层 · 眨眼", goldensleepy:"金渐层 · 困困", goldenloaf:"金渐层 · 猫猫面包",
    goldenpawup:"金渐层 · 举爪", goldenprofile:"金渐层 · 侧脸", goldenlove:"金渐层 · 比心", goldenpaws:"金渐层 · 小肉垫",
    rocket:"小火箭", saturn:"土星", ufo:"飞碟", comet:"彗星", astronaut:"宇航员", galaxy:"星云", telescope:"望远镜", planet:"蓝色星球",
    sunrise:"日出", cloud:"云朵", rain:"下雨啦", snowflake:"雪花", rainbow:"彩虹", umbrella:"雨伞", maple:"枫叶", mountain:"雪山",
    sushi:"寿司", pizza:"披萨", donut:"甜甜圈", icecream:"冰淇淋", burger:"汉堡", cupcake:"纸杯蛋糕", boba:"珍珠奶茶", onigiri:"饭团",
    camera:"相机", gamepad:"游戏手柄", headphones:"耳机", hourglass:"沙漏", key:"钥匙", envelope:"信封", gift:"礼物", sprout:"小嫩芽"
  };
  const library = {palette, groups, names, designs:Object.assign({}, ...Object.values(groups))};
  if (typeof module !== "undefined" && module.exports) module.exports = library;
  else root.YOGO_PATTERNS = library;
})(typeof globalThis !== "undefined" ? globalThis : this);
