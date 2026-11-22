var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/entities/dist/decode-codepoint.js
function isInvalidCodePoint(codePoint) {
  return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
function replaceCodePoint(codePoint) {
  if (isInvalidCodePoint(codePoint)) {
    return 65533;
  }
  if (codePoint >= 128 && codePoint <= 159) {
    return c1[codePoint - 128] || codePoint;
  }
  return codePoint;
}
function replaceCodePointXML(codePoint) {
  return isInvalidCodePoint(codePoint) ? 65533 : codePoint;
}
function codePointToString(codePoint) {
  return codePoint - 1 >>> 0 < 127 || codePoint - 160 >>> 0 < 55136 ? String.fromCharCode(codePoint) : String.fromCodePoint(replaceCodePoint(codePoint));
}
var c1;
var init_decode_codepoint = __esm({
  "node_modules/entities/dist/decode-codepoint.js"() {
    c1 = [
      8364,
      0,
      8218,
      402,
      8222,
      8230,
      8224,
      8225,
      710,
      8240,
      352,
      8249,
      338,
      0,
      381,
      0,
      0,
      8216,
      8217,
      8220,
      8221,
      8226,
      8211,
      8212,
      732,
      8482,
      353,
      8250,
      339,
      0,
      382,
      376
    ];
  }
});

// node_modules/entities/dist/internal/decode-shared.js
function decodeTrieDict(input, resultLength, atomCount, dict1AtomCount, ngramCount, dictSize) {
  const base2 = 91;
  const inputLength = input.length;
  const twoCharBias = dictSize * (base2 - 1);
  let pos = 0;
  const readSlotCode = () => {
    const c12 = BASE91_INVERSE[input.charCodeAt(pos++)];
    return c12 < dictSize ? c12 : c12 * base2 - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
  };
  const dict2AtomCount = atomCount - dict1AtomCount;
  const slotCount = atomCount + ngramCount;
  const single = new Int32Array(slotCount);
  single.fill(-1, dict1AtomCount, dictSize);
  single.fill(-1, dictSize + dict2AtomCount, slotCount);
  const start = new Int32Array(slotCount);
  const length = new Int32Array(slotCount);
  function decodeDelta(count, off) {
    let previous = 0;
    let slot = off;
    const end = off + count;
    while (slot < end) {
      const code2 = BASE91_INVERSE[input.charCodeAt(pos++)];
      if (code2 < 89) {
        previous += code2;
        single[slot++] = previous;
      } else if (code2 === 89) {
        let runLength = BASE91_INVERSE[input.charCodeAt(pos++)] + 2;
        while (runLength--)
          single[slot++] = ++previous;
      } else {
        const next = BASE91_INVERSE[input.charCodeAt(pos++)];
        previous += 89 + // eslint-disable-next-line unicorn/prefer-minimal-ternary -- branches read a different number of side-effecting input bytes
        (next < 90 ? next * base2 + BASE91_INVERSE[input.charCodeAt(pos++)] : BASE91_INVERSE[input.charCodeAt(pos++)] * 8281 + BASE91_INVERSE[input.charCodeAt(pos++)] * base2 + BASE91_INVERSE[input.charCodeAt(pos++)]);
        single[slot++] = previous;
      }
    }
  }
  decodeDelta(dict1AtomCount, 0);
  decodeDelta(dict2AtomCount, dictSize);
  const references = new Int32Array(ngramCount * 2);
  let poolSize = 0;
  let ngramIndex = 0;
  function readNgramReferences(count, startSlot) {
    for (let index = 0; index < count; index++) {
      const slot = startSlot + index;
      const a = readSlotCode();
      const b = readSlotCode();
      references[ngramIndex * 2] = a;
      references[ngramIndex * 2 + 1] = b;
      ngramIndex += 1;
      start[slot] = poolSize;
      const entryLength = (single[a] < 0 ? length[a] : 1) + (single[b] < 0 ? length[b] : 1);
      length[slot] = entryLength;
      poolSize += entryLength;
    }
  }
  readNgramReferences(ngramCount - dictSize + dict1AtomCount, dictSize + dict2AtomCount);
  readNgramReferences(dictSize - dict1AtomCount, dict1AtomCount);
  const pool = new Uint16Array(poolSize);
  let write = 0;
  for (let index = 0; index < ngramIndex; index++) {
    for (let half = 0; half < 2; half++) {
      const source = references[index * 2 + half];
      const value = single[source];
      if (value < 0) {
        let read = start[source];
        const readEnd = read + length[source];
        while (read < readEnd)
          pool[write++] = pool[read++];
      } else {
        pool[write++] = value;
      }
    }
  }
  const out = new Uint16Array(resultLength);
  let outIndex = 0;
  while (pos < inputLength) {
    let slot = BASE91_INVERSE[input.charCodeAt(pos++)];
    if (slot >= dictSize) {
      slot = slot * base2 - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
    }
    const value = single[slot];
    if (value < 0) {
      let read = start[slot];
      const readEnd = read + length[slot];
      while (read < readEnd)
        out[outIndex++] = pool[read++];
    } else {
      out[outIndex++] = value;
    }
  }
  return out;
}
var BASE91_INVERSE;
var init_decode_shared = __esm({
  "node_modules/entities/dist/internal/decode-shared.js"() {
    BASE91_INVERSE = /* @__PURE__ */ (() => {
      const table2 = new Uint8Array(127);
      let code2 = 0;
      for (let char = 33; char <= 126; char++) {
        if (char !== 34 && char !== 36 && char !== 92) {
          table2[char] = code2++;
        }
      }
      return table2;
    })();
  }
});

// node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeTree;
var init_decode_data_html = __esm({
  "node_modules/entities/dist/generated/decode-data-html.js"() {
    init_decode_shared();
    htmlDecodeTree = /* @__PURE__ */ decodeTrieDict("!}.&u%}'&}*'~!6*)%&,~!J~!J~%L~y<~!R,~~%Lu~~#GD~~#|)1#%}^%}2%+#.##%##%}&%##%'#%##&%#%#'%#&#%#&#'#%%#&#%##%#)%''%&%#%#'%#%%#%%}%%%#%#&(23#%%#&-%0%('1#(##%#'##+%'*.:1}#%#6-+(%'%%#%%%}#L'2351&('%}&/N'(0(/*-%(%%}#'+&T%7.2}#&%&#%#36/5##%&%%#&#%%#))2%%##%&&'0~!#*+&'%1~!%).'3q?&%'1~!.##%6(~!+%%%(Gw'rT~!E#<nA%#jZ~!H%(~!42##~!*31&~!G%U~#)5~#`3~!J~!Z~%]~%Y~%C~!q~!u~#kz~%#~!6'~!D~!U~!?~#T~!c%~!G#'~%7|~!G~!J~!G&~#pb~(Df}#%}*&}#%##%##%##&#-}&'#'&%#.++}%mI,#,@&(}*%}*'%&##&#%##%}&0}#.},U},%}+%}&%}#%##&}B%(}(%}+%)})%##%#&}&%##%&}<%}>%#%&}*%}(%}9%}/%})%}*%}*%}?&}&%}3%}&*#%})%#%#)}#&#-#+*%E%%'%'#%}#*V##&##I}#&&##%&%#&&Qf%%))w/0+&%#(#.%-''''++++7}>%4'',##1,#%#&%##&#'##&#*#9)%&%}#*}%,#+P(%A&%#'&##wSD',9E00#y#@}(+}&%&>~!#~!X}#*}(&&}(&}(,%}%&#+&}#&}I%#%}%)#(},'%#*}4%%#%}(''}#/##(##),%-##%%)#&}(.}&%#&}%%}*&#%},&&}&%}#%*'#%})%}D&}&%}-&}6&#&}-,%}#%})-(~+`~,=?~I9'9%~!,#%})%})%}@%}?%}(~!?~#<~#pP~#BG~#=1#%K+~#?#~%;)~#A~#mF1~#A'~'X%'~#lR~#N~'N~#r~#m#-~#i'?%#'%~#B%##%,%#~#_%#0%~#]732~,w~2+#:&#%&'0%&>%}#>##F+)#%&&#(+_}4&}-%}(&}@&}O7Fdf0@+/v4}&WU##&/0#&'('B#%}.%}'+#%}#%%&#&%#%##+#&#)#6#'#.},%}c%},%#%##%&#&%#&~#>'*-.%##%##%}#%%}%'~#)D1}#%*&~#_%%'(~#S2%'.}#~#=##*'*-%}&'%'##&&~'E%.#&~#M4}%%##&'%#~#O1##%&#'+~#<B%##%%'%+~#;#@%}#&%#&&%#(~#H1}'%'##&&~#?A}&'~#D#%32}'&&&&~#[}'(#%}'~#;C})&}%%#%~#=&%,3}%'(#%%~#^'#&&)#%'~#Y%-~#d-%'~#^%%&#&&&}#~#b~2t*&'~&(~&@~0%~e~3}%*''0})&}+~!9##-}#%-hD*)1fC#%/&/fB#40~!+#)*4~!+~!K'&:~!/*7~!.#~!H~!L':~%x&~!H#~!*~%1~!I#~!+A~#p'~!F~~#-#~,,(~.Z~!V~%;'B'mq-W~!N~%I%#&&#&}#%},%%}'%}+X#%}#&}(%}'%}<%}#%}%%'}'%}:~![)9@~%>~#UA%-%##&~!C%~!-.9:~!1~!-^2/:a~!y,D*J#-5)/4~%23,~#G~!L1~!0X3`~!2+~!!0-~&E~!W~!o,>Y&]~%cZx_&~#O*9#A#'#+I'%#)~!0B*-5A+-((F&*M#)(-7-5+'-3a5Vi~!Y~!?+[)%3),ERHm~!+:D,VG.+)?fB%%*(%)'(#&80%1'8`K8?`+'Z#&O&'H5#*9)A%%5&3))0%39+.*7#()&&*=4@**L)<'_&*+..;(#*+)./&0#3)%')-8(4ixD(&.}%,('aI:,)%,k2231T)I'#/-W7,/'Q#.'Y24+h')37</31&83##&0#),H(?'&?/1##%#&&#%''-%&&&#(&''&#.-'%#%%(,')*'&#&#'##%(%(#%('#&##%%%%('%#%#%%#%#&%##h>w+v<ayvyvcg.uuhKr}g/v|g>u9i[~>g5uI~=RvdwEg;v/g;uk!!TTSx]@RT!U!#!@VBRUU!'UTe-d0c`e&gSdicedFcrdTaqb.kYcAohdYd@a3e+d}dMdtd.aJ#bqcK`dle/e.e'dwdPdodddjbEb}ogd^ofdpduc6j?l%d{drdqc)d7bacOdQ%T#Y)X.sR[yH>6Vyv3[xwLu>vo'!*.[yBacahoj>6Rew3[xqdZa#!a&#^(X-[yG>6Vyu3[xvg3sEr|g.u/Ri9db0T#^(Xa)!-[y;>6Vylg4wKs{JwNZt3@3r=c4Z([xlg;wKt!cpq's@v7A'*a(a+!-a#[y<3Dt?3Dt'>6Vym3[xmg9rxsNJwLZt4~?r?db1T#`-!(Xa,!0[yS>6Vz%NuQs.g4wKtnJwNZtS@3r>c4Z([y%g;wKtrdga8!a(!#&T*Y-Xa#!a0<or[yc3Dtq>6Vz43[y3JwNZtf@3s!Ju}!%Dti:pm3c_%X#tjB5pkd6q!r]u?voC'*-a.a2!0a&a+[yI3DtI3Ds~3DtH>6Vyw3[xx;:s#~<5pKJwNZtE@3r~d`a)!a2T#a.(!+U.X1[yT3Dt`3Dtv>6Vz&3[y&g9rxwzcxstPu.<rAJwLZtT~?r@dZa%!a.&^*Za(/Reu[ya>6Vz23[y1g3sEr}wkg{NuQRg{ci(U#5@b`~,cg#U(2WnH5wugcRh7dX#T(Y,a'Ta!!a,[yZ<]mj>6Vz,3[y+Pv#5ReZKu+=,%!H}7ABwkaS?Rh:BcW(X#<]mrj:ubv/ARekdg%!(!a.*Ta(Y.X1!#sP>Rl*Dt6[y>>6Vyo3Wf*jOvuumvuRgRJuq*!:9<B@bX~3jVv&v@s@5Re[d/rQt{uAvo&a&a*)a2!,0Wf!3Dt0=Bs'>6Re}3[xy~<5s%JwJZt1~Gs)c;&!#2sJkNuXvzq7rxu,Re8dka4!a8(aEZ+a@Y.X1Xa)[yd=Bs(3DtP>6Vz53[y4cX#X&Re:avRe9~<5s&JwJZtQ~Gs*i^rzvdRg+Jv{%!2sbB@bX}kdga,!Za?&^*T1/!a'Dt+[y6>6Vyf3Wf%g/u;s4hGu6?Rh-JvZ,!c%#&RoX54Rivj7uyvf8RgTKvZB%*!2sGh<vu5Rgq<=C::9bb~#dZ#T&Ta6Y.X*Dt>[y93Wf)coZ(T,6VyifluvRgC@95@B@bX~/hFu34cC#T,k/unq8w8Q5RkUklwQuzunq8w8Q5Rk8d/rJu?v8w9)-&!a0a;a&aIWejg3sEr/h1s<DtDJvyZqY5aws3Jvy!&Wei~Hr1:au5@Bag>23E~5c:Z&bX};kKv?w&unuVu5Rjc;>bs)#~@:Rh.=ay<a]C;b`}Vd6s/t{uAvoaxa()!a,a7%-a#a2Dt,[yF2Wo[>6Vyt3[xuNuPRi&NuPwpi#RoWh?vf8Ri%Jv]!%Ri:KvxD!.'2WeAjZu`q9rxu,Re7woeAg-unLq(qA_/*2Wg_g3u5q^9:4E}/jTrxrzv=Wkkd~0UX#^^Xa-a1a5T&a=U1a'*aEa]!a*aPaA-adok[y54Rn>;:p3~Dp5g9rpsFNvZqjg3uJp4~<5p0Pw;5qlJwNZt*@3p1Pw:5p/Ou!5p2JvG'!6Vye=<qnJvh_[xhg3v,Rh3kOwOw-sDuev/Re^dha[a%!%!a+#Ta7)-5TaCaO!aka!a)sf[yb2>Rl!9ARiq5E}Qg=ucRkBE|oJrJ_@Wk~@Wk{JrJ_@Wk|@WkyJrJ_@Wk}@WkzJvO_[y2g-vMRmiKuYC!)&>Ri;>Ri<@3RkNc](X#@9Rk=g5vuRmhKvDB!+'=]meg3u4Rmgd)#Y'Vz3CARmfd`a+!%T'!+#Ta1Ta6TaM-sTDt9[yA9sYd'%Y#s[[xpj:ueunaXRgEjRq,v-vuqdd2'`#6Rev<32@5>:2<E}5xIo9a*X#Y(;5RePJvD_g>vyRgNj8w)v8<wggs:RgXiZt|vjx,hSq3ah!-(~@:Ro/Ou!5RhWj^v(pyw8unRhUdx-UY#^Ua.a3a70!)%UX1TaDa)'omRiRRhE[y:3Dsz=Br,>6Vyj3[xkg6ruwjcqsrPw;5r*Ku]D'Zt-@3r(~?r.i[vwv]dU1a--U#`a4(g/vsRhPOu!5RhLj:rmu9Wo!~@:wdh@g/vsRiTjXuvvNr}:RhBj^v(pyw8unRn]dz1UYa'a+^Y(!aETZalaRY.Ta?a4[yDJw1!#qLsW>6Vyrfzq-pLflpwRe|Js>%!Dt@3Dt&Jvy_[xs~HrnjMuwpsw'RecKu+D#'!t<~Grl~?rjg5u-x,gwp{ah!-(~@:Rg~Ou!5Rh'jXuvvNr}:Rh#cW#X/c;&!#2sLi[v7u7RgpJv)(!iLrxu,Re6j7v@s@5Se[e7d`aW!Za(a`T.a#!a3!&aDa-!9)Dt_=6s+3[x~~DR|h~DS6avhGun5RkZj3w)v-]mkKunB!&*]kb97R|i<ARk<c:Z(6Vy}Juh'!wziMRoS:F|vkLuauJv5vtvQRh1d='T+Y#VyO~DR|jcF#T'7R|g97R|kJv3'!ay<Rj,Jvh&!:ReXcsa6*a+#a#_aIRf9aLRf?c,Z&Rf5Rf7c.Z&Rf;Rf>cQ#%T'p-Rf8Rf=ct#%'(*!,p,Rf4p+Rf6Rf:Rf<d~'Ua%U*^UYa(!a,-!#a4YaTalaEX0a8a<Weo3Dt/3Dsx=Br93Wen~Dr;~<5p<JwNZt2@3p=Pw:5p;Ou!5r3c7&!#:p>3Ds}KvGB)_6Vyk2sM=<r7x'eovA(!hFu1ARf}cV#X&@r5j6rvwQa^Rf3c=Za'wkghJv__g;unRggA53B9=b^}%j6uduo5Jq;!(hIv%2Re`Ou4ARe_e%a#^^^Xa&!a*a2!&a6YaP!*ad!#a:aE/5Rn?[y@>6Vyp;:pE~DrY~<5pBJwNZt8@3pCh=rt3rWPw:5pAJup_[xoNuPpF9c!#'45pD5ARn)d8#X'X*3@rU72s]h>v<<sSjJpqvewOJq/(!hNw'5ReBk0s2u3w/w'5ReE5@Jq.!a+JQ!&WeU23d(#Y&RjG5]jBk!u7w&u0udARjEe#+^^^Ub#!a2/a`Z(agT1!a-a;|@TaG!aS[yV=Re~fow'RguNuPRe?bz#'>RoUWeL>:Cbb|?JwPZtVg6ruRmzJvD'!6Vz(g/vmRh~Jvy_[y(g9voRgyx*cy(#2>Ri2B9b]~9kIw9u7rluJu3Rg]dI#a%UY'@=p%CAx.gQZ&RhwwygtRm{x5g_Z'+ABqR9Woa=Bp&dV#^*Xa'!&@o{g4v]Rk;Jv{!%Rk[wkkiA5RkiwwfUB=x,fUuqC&*!>RfTg8v0RfV~ARfSd;rJsAuAv9wR'ae+/aO!a@aza/a#[yQ@Wg!2Wemg3sEr0JvB_g>uvReWg2v+Re=KupB_+[y!2AbY~-~Hr2AJwD!(h<~El>h<~El?Kun@+_:9b`}Kg-v/Ri3g;vtwyk_9]k_d=&T#*U.6qh@Ab`|K9:H|CJv[!&3Dtex'fDwC%!Rf[9WlMd[(^X,!a%Z06Vz!@WgBg=v~Rgvg,QRe@awd,#Y+jTv|Q~EfWj]uNr|~FRfXdy#Y&^Ua%!aO.!(a)Ua;=!a@aKap!a-,a!Ta]a[rSa]p?[y82sK=Bq~;:p:~<5p8Pw:5p7d'#Y'Wf(;RnRi[u4w&RgJJvG'!6Vyh=<r#ijuuv/sIKuYD'ZtG@3p9~Gr&d2#`(g<vtRgFj`u5w&rqpxRf2CJuY!+:wfnTOu!5Rg}jNs1ucv&RfwJvA!&3@q|BDcC#T,k/unq8w8Q5RkTklwQuzunq8w8Q5Rk9dga#!a'!a=#a0!:+Tb*b@aO.a4!aba8aFJv^}?!VyR~Dr<g;u%Rn.~<5p[x'e`wNZtR@3p]Pw:5pZhNvjBp.woe_g5u-r4JwF!%DtO3:ooc7&!#:p^3DtpLuGw(!+%)Dtk6Vz#2sd=<r8d'#Y([y#<x3gJt`w@!)%}MRiowzikRij=]ilxAf3,U(#B2Rf#g0v-Rm[ck{`U#]giKv3>)!&6Ri154s,KuGB_%@r68r:dJ|t`#X(9<E|u2@H|rx3gJu?w'!+'1Nu7Reg4=H~+9<wxgY95Rm]xLggZ-`(X}U2:Ri4h<uOawRmsJv__5@bb{jbV~3dka#a'a]!,#a+U=a>b6a3b%!/aKa/)!arwve^VyJ;:pR~DpTg3uJpS~<5pOPw;5qmPw:5pNOu!5pQJvG'!6Vyx=<qoJvA!{~Jup!%@qk7Rn/KvyD!}''[xz;>wkh'?Rh,x8gyt`w5D!&),(SgyccRgztJ@3pPB5p#d'(Y#<]mmifubw&RgoJvE&!82s^JvF&!8Rf,ADb]~;x=h'rNu]vK!,%'*0RnORh)4Rh*AqQg-vaRnNg;wHwkh'ba~4cE#Ta*x3gctyw@'!+%RnFRnD<4Rn@hFvK5RnCxWg[#`&a0Ua()`1Rm75Rg[c]%X#qi8Rg^NvdRj>BwzgZauwji7Rm6A4wgg]d1#&(*,.0a#Rm;Rm<Rm=Rm>Rm?Rm@RmARmBe%#^^^Xaea?aC/b+(,!a+a#!a/!>a&Ta<aKbD!2wphBRnk[yPw}hE|.=Br-3Dtm>6Vy~g6urRf.x,hPrNav!%'RnqRo%Ro#Nu;q[Pw;5r+JwNZtM@3r)d'#Y'Weh;xChL#`&RnmRnoKu}>%(!Rne~Bs-;2wjcussJv+'!aYSO}6@B<5?ba~8LrNvj!.%*ROwungw~ng~:9;Ri^>wtnig;wHRnixDh@|(UZ.x1h@|)!#:2<H|*xHn]#-UX'3Ro)z=iT}6ARns=Bwsn_wpnaRncw]aR(#UXa&Ua*a/=]iPd'#Y&Ro'WnXf{QRm2hNvj]nZd`'T~&1`{|`#9b]{}c:'!#Wl{>@=be}]?cl{{U#:5Abb}Jds#^YaF!a*b4a#a3aPa>&Tb!bH!*a_!Eau?/a&RjY<]gj>6Vz*;:pe~DrZg,QRj1JwNZtX@wihspcJvZ&!VyX9WmOJu|!|N2WmHJvh&!]ht~Bpbcn&T(!#RmQ<s7Nu;padH#X'`+WmJ@>RmKCARhnKup=!)&Wf+:RhqNuPpf9c!#'45pd5AwghpARn(Ls@w!%,)!RmP@Wfe<E|IJva!&WmNg8vsRmLd`*.`#Y'Xa!axRn*]hrA8Rhug5s@rXg8u!RmMd8#X'X*3@rV72smdI*#UY&RmICARho~GsgxVgd)Ta'U-Y&Xa!T#RnEWnA@Wffg1uDRi0hFvK5RnBxGnG&#`%owp)@wsf+bX}Ze-*1!a*^^^Ua|!#a.aq&Ya2!a>.a6!a:aO`aJDtL[y`@Wg#>6Vz12@wzoYRoZNuPRi!NuPRhzg=ucRi,@=b`{Yg=ucRi-ACJvB!&Sh[ebSh]ebi`wUuFRm4Jw2_[y0JvB!.<Ju(!&SoG}6Shd}6<Ju(!&SoH}6She}6Kur@._g5vHRieJvx!{L2G{Kx6gd'T#?Rh82Wi5cZ#X(g1w)Rm5dW-Y(Ta#!a)!#aYa=wnfE=su2>>bU{0j9udv:<svj8uQv-7RgHdE%#^'sq9sp=>Bb_{TJv`!&g/r|snj6v(us5d,#Y(56H}[978H}]Jw5!&g1rushJvB!+j;v{u5?zDhd}6}bj;v{u5?zDhe}6}ce*#`(^^^a[aea!=!a6a*aoXb1a.!aAbL!b>,b'aL!aV@Wf|2Wlg3[y/JwNZt^@3piPw:5pgJunZou3@rsJva&!Vy_g<v~Rm#JvG'!6Vz0=<r{Ju{%!:pj@WfsiXuJu3Rm:JvZ&!WfA~Bph@c4Z&Dtwax5rubx(#:awRk1@d,#Y&RfjRfid1#,Y(@Wfp2Wlrg5s@ryKu[@!,'=]ig9wlk?Rk>g5u-rqJvy'!@9RkQcH(T#=>Ri~@<wkj(Wj(KuZB*!&<7rw@9RkRcH(T#=>Ri}@<wkj)Wj)dg(Ta2Xa9X#`-!a*CARhg@@=I}d9x;c~#X%so=<sj>2@@=aybb}XjWv0Q~EfEj3vLv;<d,#Y(56H}`978H}_dgaPaFa'a/!#a3Y0a_a;a|!1(a7-[yE3[xt;:pJNvZrrg3uJrvJwNZt=@3pIh=rt3rxPw:5pGOu!5rpJvG'!6Vys=<rz@c4Z&Dt(ax5rtJvZ!&~BpH@wsfNg-vaRlNci*U#=<wei<F}a5@Jq.!a*JQ!%@qZ23d(#Y&RjH5]jCk!u7w&u0udARjFd/prq=tyvpaEa(a:.!a1aZ(@@=I}:9wpd%=<sX55w_h}@@=I{t=ay<aU@@=I}T=ay<2@@=I})?C9:9au@9Cb]}DP~=x-fAZ(2Wl1=ay<aU@@=I}>5@d##Y+jTv|vV~EfFj]uNpn~FRfGdgaK!Z2&!a8a-Tb({E!acTbM*!a(DtY[yYd'%Y#sl[y*hHvh>Re5x2c{Z}.j4uCvcawRiMd+#X+_x&d!},<5RkX;2Hzw@x,gavfB-!{CcF&T#Roe;RodwWbBg5urRgaKvHC*_6Vz+<4opieuew&Rmq@d]&Y)X,T#X0Rh}<BqP=4qS9:ReMg/ujReNJw0!/<Jui%!bd{kawwnemRelAxUa?a3#*.&UX(Ya+a/RhvRnQ<o}9Wmtd-#Y&RgSRmw9;Rmxay=Rmyg-vaRmuxEhSrNu,v-voC!%(aR.a(a7+1Ro1>Ro5CE{A9b]{@;5x#eO{:g;urRi+KrNA!%(Ro3>Ro79;Ri_Ku@>{;&!x%gX|{KunA_+g5QRj/g3u5Rj#g>uERj%wio/xRhS&!,!#^1U}wba{8>>@=be}qC@:D5ba{7Ku+A&!}x?ba}t>>@=be}se(aA^^^Uat!b0#{pa+awUazbGa#aLb9bgaWac'a5TbS=Br!d1#`%scp_Jvl!#rT>Re0JvX&!VyN=H{Fcm#U&:pY=ReaJv2&!]h0=]nUJvG'!6Vy|=<r%JrM_=]h2@Wlud'#)U'Wf'b]{i=]h/Jvh!&~BpWg=v]RnMx+ny#'Nu;pVwjnu=]nwxJnx,T#`&Reqwjnt=]nvieu9vrRjLLuYwP(#+!th@wih5pX~Gr'g5v/Rh4KunA'!-CARnP@wwiN:Rm_9x'cvw>!|l=<saKvAA!0&3@q}>w^e1bp#&Re2Re3BDx7gH#T|f5H|eKuZ>!%(:qNAH{]Jv6!+3B2B9=b^{X<5<B92:E{ZLvhwA(a;a%!igQuyRmad+#Y}m@3Rh5d8#X'X*:AqUAHzmaxwbh<aXRnVcF}RT#Nw&cj#U(BWnug/vsRntdka)(a3+.Zb7aYYan1!bVa@Xa}[y^@b[{G=H{+hFu73Rj&Pv#5ReQcK%T#sig1v{Rj'Ku+D#'!t]~Grm~?rkKuMB!01d5#`'Vy.ta3Dtu~Hroc8#'{^45s85AwZbP&!#Rn!wghxWn#KvEA!)&2RlA2RlBx:h|#(T,=]j09Wobz>x]z/@awRoTd+#Y(az]hFhCrm4d,#Y+jTv|Q~EfMj]uNr|~FRfOdCa!Xa9_X#@<plJvf!%b`{(9;Rgwc;.!#2x7cw#T|UDb]|T5Ju={(!=@E{&Jv)&!Ab`{'awJvf!~*>>@=be{#KuY>!+&4Ezyi[ugv&RjIdea+T)#UXa&T-T&a!Rh9auRmW=]kLg5vuRn+g3u4Rn-Ow6ARn,hHus5xNk?#UX(U~)/g8v0RkD~AwkkF?Ri.OuNBwkkA?Ri/d|a2`a*^UYa.!aBTZaTa'Xa;!(!2!-a#b2[yC>6Vyq3[xr2Wi?g1rusVh%s?DtF~<5rbJs;%!DtBfswKtCj[uvuSsEu3RgVx3o:u+wN'*Zt;@3rd~Grh~?rfg8w)Lq)qE&-a%!>bI|`jWv0vV~EfCjTv|vV~Ef@j]uNpn~FRfBcK#T']gWNu7x,k7q4ai(0!hHv8<RhmkMu9vrsBuev/RhlCJvB!,g<v{wchh~@:Rhji[vrv{wchi~@:RhkdS&a5UY#Ta!RgPwwiI5BwciI~@:Rh`x'iJvj'!5]iJPu8Bwch]~@:Rhach)U#h3rp]gLh@t|Ax,hTq3ah!-(~@:Ro0Ou!5RhXj^v(pyw8unRhVd|)`,^UYas!a?/a2Z'a^Ta{Tb7Ta(a#!a,Wf&9sZ3DtAadamov=Bqt3[xig8vsRm~>waiL2b`{QJv*_Ouv2qgj<v]v2BqfdR'X*X#Y-@3qr~Gqv~?p6hHv-]glPup5Lq+q?_%*b_{qF{n9b^{rOu4ARhpKvCD!+&~Bqp:5Dbb}nwoiKl&unuTuBv]v+ueunaXRf0=Jvh!0nKufu8v1w&w7q%w&uHrz:Rgnj5w,uxDJq/(!hNw'5ReCk0s2u3w/w'5ReFd>Za&!*UaA=<wkgsRnSJv^!%Refifw3vyRgOKu_B'!,<]gkiiu:w&Rh<=C@a^<B57@2F{[<B5@aW:=3away9A5aW=<B=C@a^<B57@2F{Ie-#`(^^^bCara.b8aza6!/bZ,!adTbnTbOb+aFaS!aAT9@Wf~2Wli3Dtl2@d,#Y&RfnRfmJwJZtN~GqyJva&!VyMg<v~Rm%iXuJu3Rm9Jv[_=]ih9wlkDRkCd1#`(@Wg>2Wls3cH#T(@<Rj*=>Ri|b~'#23s9h<~El.d'#Y&Dtxi^rzvdRl#d*#U%(o|B2s`hJwSaxRmDKv4B&!1:Rmdd5#`'Vx}to~Hq{x'f1v3(!BA5ba|bJv_&!Wfug1v]ReIdO+U/Y#&G}-8wze=Rh{g1v]ReHg/uQRf/by#)ibQwERl/cH#T(@<Rj+=>Ri{cNu+vlax-!(#a0qa9<Rii2;;bU{H;x<i=&X#Rk`<4wwi=C9H~8xAI(Y#<azRi@45wXI<B9;5bb~7dL(X#Xa(+!aL6Vy{g5QqOau:5au2@ay547EzbxOcU(UX-T#Ta#:Cbb|A?wjh/b_|SOw6ARgtihr}u7Rhy<d1#T)X1@@=I|~=ay<2@@=aybb}Sj3vLv;<d,#Y(56H}A978H}@dGpvs@uAu`vcw9*!aFa+ai%(b!aXa8.a?a[ozWey=sU2@G}Nch&U#Rf_WexKu+D#'!t:~Gr`~?r^j]uNr|~FRg*j^psurwJt|RmcKv)@&!)7Rkv~Br[@wxfO:Rl3co#U'6Rezj_q#vIuavjRltwzeyh@vr5JqD0!>aY?C9:9au@9Cb]}9cl#U*5;5<H||jbuus1ucv&Rfvg1v~d/pppzqFr^a--a~!aMat1(hFv;Wiz@@=Izoj5uuv-7Rix~Cw`fk2WlVcZ#X,k)u3vWs@u2]ktg;wEx'fBq(_2Wg/jTv|vV~EfoJv]!15x'hzqG!(P~EfU~CRl_j6v(us5x4i-#T(2WmZ?C2F|d>Kq<aj1!*jTqIsBv=Wl`~Cw`fi2WlWj`v0u*~>RlR=c>Z,k#u3vWs@u2]kr<c1Z+jTqIsBv=Wla~Cw`fm2WlXdmb3!a{(arZa`bkTa%TbQTa-a9+c'!aM!/[yL=Bqug.w'RifhFvyDRj.g>vgwyk^9]k^Jv3_@WfbAARkhJw2_[x|JvB_wkoIRoKwkoJRoLd'(Y#<]gm=<9<H|yd'%_X#skDtb3awwqkgNulRkgdB#^',9:p'hJwSaxRmEBwVb8@4=H|qLu+w50&!)@3qs~?pU>Awwn;;Rn=c:Z'ARn<=<qwKvC@!/&~BqqJv6!&]eVb^z^xRge'/a%+^`#Sge}6<4Rn3=]n0Pw2>Rn8Jw0!&>Rn:>Rn6cY#a7+!a&=<wkaNw~h3z_c5Z{=wjh#=]nLKv^D!&)Vyz=bW|swYb<WetcG#T(2wxa@qVx@gD#Y&b^|V5JwG&!5bb|pg/w&RgD@x=kHs=uAvn!a%%/'+RmSRh694Ro`g-vaRmRhHv-]mlxCcS#`&ba~.5cD#Ta)P~=d,#Y(56H{>978H{Dd_#{2^Y%_+qbbb{6g3sERhsbU{?dfa.,`a(Xa<!aiX#(55RiG54RiHcI#T'WiU3RiVNvdwtfcRlKNvdd,#Y&RlHRlExQgf.1*^T'X#Sgf}6Wn4=]hfPrk>Rn7Jw0!&>Rn5>Rn9Lunw?&a2!,5<oq@@wqfdRlJj5Q~=d,#Y(~ARfcOuN]fdDKw;ay(}i!547E}j?cI#T(@5bV}iCbV}hdv(^^Tb?a40,b##Tbo!a*bR!a<b|a/!aKai!aU[yK=]o^g:v>ReGJwPZtK<7Rh+h<~El,Pv#5ReR@awwxjCg,ulRjDJv6&!]j!z?aQeeg>w=Sh<eeJw;!&axEzOg,Qosc!#*:wkeJ]eJ>x'h-u(!%Ro.w~h.zPdNZ(X,Ya![x{;9ReY;wkgxRiF:x?ap#Y&RmUg<s2Rkod]+UY0TZ'!a&A9sw<=bczLNvuw{gqzNhJwSaxRmCKuLay!#&s_Rf-55b^{uJvZa!!c%#(55Ri654wmiu5RiuawLu,vp!+}^%b_}Y9;wkgxba}o>A9:=b^}zKuh=a''!3awRk3c*'!#aHRk6c+Z&Rk5Rk4Jv)&!awRjSawd9*`#0?C2@EzMj8u<uJ5RmbjQrquJu3x,k>uq@_+=ayb^|W~ARkEOuN]k@7dhzV^X/X&a-#zRzSb`zXcJzTT#2WkVKvDBzW!%FzY9;5bbzWjQrquJu3Jw3%!b`zU=ayb^zQd:#X(T-a!6Vyywxh}=b]{Jg=u1RiAdGp~qHtzv!w(wA+a+a;<!aJaYai'anasb(=azRmV:Cbb{MLq2vb!%')RjuRjrRjtRjqx3jnqCw3!%')Rk(Rk+Rk&Rk)Lq2vb!%')Rj{RjxRjzRjwLq2vb!%')RjsRjpRjfRjex3jcqCw3!%')Rk'Rk*RjkRjl9<CbbzfOu4ARhxLq2vb!%')RjyRjvRjhRjgx=joq*uKvb!%')+-Rk.Rk%Rj~Rk-Rk#Rj}x=jdq*uKvb!%')+-Rk,Rk!Rj|RjmRjjRjidAq&qKs@uAv8Aa.'*-a@a&0!aM@a5[y73Dsy3Ds|3Dt):wxgI2sHJwJZt.~Gqxwsf0ikrzt}Rl0Jvy_[xj~HqzKv_A|D!&WfP8axRoVcf,U#k(v]v+ueunaXRf1Ju}'!g8u#Ri=jQw!sCunLprq>!,')~<5qeGzq9F{W=c##%s5au:5aU3CBE|;d4#X(D!a&6Vygx(b;#(=]ed?C2F{N<capoq2r[a&!aPa9,'Pw;5s:@@=I|,55w_h|@@=IzcP~=x'fCqB_2Wl2>aU@@=I|1OuNBc1Z+jTqIsBv=Wlc~Cw`fl2WlZ~AcTa%!Z+jTqIsBv=Wlb~Cw`fh2WlYk+uNqJsBv=WlSg,u3dca3#UXaMYa)TaB-=cM|7T#<bI}l5@B932:aV2G{BOuNBJq:|M!5Ezt=<B=C@a^<B57@2F{v>cB{/T#=ay<bI{3Jv6!a.6BKq0ah&+!5E}HP~Ef{978BaU@@=Iza<7d#.Y#978BaU@@=IzH~AJq0!(@@=IzG978BaU@@=IzFe,aU*Y&^^^bvJb,b:bFad!a,c2Ta>aL.bo6!a#CbTa'T#Re{2Wlh2@G{yg6t~Ro_NvdRfticuRQRllJv3&!x&c|zs@Jw3!%RflwpfkRlpKuL;%(!Re<@G|C2GzdhIvuBwgjAg-u0RjAKQB%!(GzZ@G|5NuuRl7d='T+Y#Vy[g<v~Rm!==G|>JvA!)@wma=]m1ifuaw&RmnLs@vT'!|/+[y,g:v>ReTJw1!#qX=x!eC{bLu+wT&)ZtZauq_~Graci&U#F|89:r_Lupvq!.)&2RlG8RfaC=x!eF{_h?rpWlmd&'!#X|&]k::xJey#`'T|+<E|&2@H|%dE#(^,g;u.RiEg6vjRiC9xCkA{O|zY#g=ucRmXKs0@!&*@G|m@awRknJuh!,3d(}gY}eJvj!%Rm):Jw3!%Rm+Rm-Ls0w(&!a(a#@b[|6cZ#X'7RkxWgAOu4ARn'dH'U#Y*Vz-Wm'CARm}d]*#a%^a*T'aK!a<9bV{PC=p*Jw4!&SgxcbB5r]idw(wBRmF7xFkt#&`(Rm/Rm8E|!JuY_9:Rl5=wrgr2:bbxd@xXfB(a*#T+!.X0X1Ta/a'T&RlDRfL>RlyARl9b[z[>RfZ:RlL:RfRwlg/ARl;9;RlxKv,A/!%7s69<74=BA5ba{-8Bde#`a<XaKYa1,a'P~=wxfB2bZ}}?C972@@=I}r8@55B9;5bb}G978B2@@=aybb}3j3vLv;<Jw3&!>Rfk=ayb^}4~Ad1#`*@@=aybb{w2@>==<bbz]dx+UY#^UaF!a9!bB'Ya1.!ajXa#%olRhD[y=3Dt#Ov5BrHKuMB%!(Rf^Wep~HrJwkiQjKr|~FRg)Ku+D#'!t5~GrF~?rDdV)UY,Z/_7RkuG{<~BrBg,rlsO:235B@bX}|d?a1!#`(6Vyn5@d##Y+jTv|vV~EfIj]uNpn~FRfH7Lq2vb1!a9-978BaU@@=Iz9978BbU}#~AJq0!(@@=Iz8978BaU@@=Iz7~AJQ|}!978BbU}!JvkaK!AdUa21-U#`a+(g/vsRn~Ou!5RPj:rmu9WhOjXuvvNr}:RhAj^v(pyw8unRn[kPr}p|u7vwv]RiSBd;pppzq@qHQa?(b.!a.a`@.|xa(hFv;Wiyj5uuv-7Riw~Cw`fg2WlU978BbU|wOuNBJqG!(P~EfD~CRlQcZ#X,k)u3vWs@u2]ksg;wEx'f@q1_2Wg.j]uNpn~FRfqJv]!15x'h{qG!(@@=IzK~CRl^j6v(us5x4i,#T(2WmY?C2F{1>Kq<aj1!*jTqIsBv=Wld~Cw`fj2Wl[j`v0u*~>RlT=c>Z,k#u3vWs@u2]kq<c1Z+jTqIsBv=Wle~Cw`fn2Wl]dn1#c(a(b^a2!b/bAT(bj!aDa7bu,a_a{c0!2T0g:v>ReD2@G{42@G{5~DpM~<5rc=Bx6i>{RT#RnI@zCx]y]z:2Jv[!zr5Awyk]9]k]dD(Y+X#6Vz.g=wKtgwhaCwgmTWj2Lu,w%_+/[y-B;b^xeg3u3Rj-2@bX{*KrJ<!+'@Wg(g?QRlC@Jv`!%b[zIwsfII}8JQ_@w|kW|=Jv(%!AqcOuNBJvEzh!bYzjLs@wP#(0!oy@>RkdJwMZtc3Dtd@BcG#T'9bWxg2@2Fznd*#Y+;2x'c}w<zizixNgwa#Z'U+!/!a'!a+w~g~z6wcn{Rn}wcnzRn|5Rh%=]nJg5vuRmvNvdRlvcprJu}w*az*a#!%.a.'Bot9qT]kj@Wg'ay2Gzv@Jv`!%b[zEwsfHI}1;ck#Ux`<Cbbx_Lu+w!a&0*!wko*wwo,So,}6Juqxf!E}PigQuyRm`d3(`#8>Rn%:A5B;bZ~%KvhCa!a2!x>k7#Uxb@b{#xaRk7Jw0!)>wwhlShl}6>wwhmShm}6CJvB!.x'hhvj{!!5Bwkhhbaz}x'hivjz~!5Bwkhibaz|xEhTrNu,v-vpD!a%&/)a3a.,%Ro2t[CE{)@3re9b]{%wjo09:rgc:Z&Ro6=<riifuaw&RmoKrNA!%(Ro4>Ro89;Ri`dSaL'UYzxZb)7Rka3xRhT&!,!#^1U}vbaz{>>@=be}yC@:D5bazzKu+A&!}{?ba}y>>@=be}wxBh[t`u~vJvr!%a!a()a,a0a4RoC=]o;Ju(!%RoGRhdwjh`=]oAg>w#Ro?g5vuRo=NvdRl|Ku]C.!&;RoEJvB!%RoORoMBx'h[v+_?w~h`}~5?w~hd~!xKh]oiptu-utv.vp!#%&a30a@a'a+(a/aOp(o~p!RoDJu(!%RoHRhewjha=]oBNvdRl}g>w#Ro@g5vuRo>c[#X']o<CauRoRAd-#Y':RkpauRoQKu]C.!&;RoFJvB!%RoNRoPBx'h]v+_?w~ha}t5?w~he}ue!/UbhYacXaW^Tc&a;b:a-c/#b&aja1(!cL+!bKbt!bmcRc9aIc?8[yW3Dtt94Rg`Jv}!&SiRMzBhEebShEMNuPRe>x7gL#TzuwjirRipc<Z&>on;>z=h-MSh.Mwqczx'a7vj&!>Re4@=ResJt__NuPRi*NuPRi)j]uNr|~FRfzKrJ>_+@Wfy@Wf]2WocKrJ<!+'@Wg%g/QRl@@Jv`!&awRl<wsfFIzgLu(w*!.*&ShBMwvhIRhI9;RhNx1hK'!#Sn]Mx1hK~0!#:2<H~7cNu+w7D*'1ZtW>Rn1~?rOc:Z&Rn2=<rQ<7wjh&=BSnLMc]#X(6Vz)w[b=a!U#9wzgMc3#&(RgMRitRis<x,gKt`ax!&+SioM=BSilMc3#&(RgKRinRimKurB,!&SiQMzBhDebShDM6BJQ!(P~Efx978B2@@=I}WLrJw!!,a*&@G}O@9wkibRid@@x'fKwC!&SlDMSfLMjUv~Q~EfKKv3@a+!(hFv-]mpx/hYZ(C5RiWz<o/MwkhY?So/M@x,gbvfB*&!SgEM:SoeeehFu3:Rgbda(,^TZa)X/7Sg[eb:2RgI~BrMC@wgkc:wwkcRerx3h(uUvK!&*,SnOM4Sh*MArRg;wHRh(x=h;rJvPwI!a4',a'0@Wg&=BSh/Mg>w=Rh=g3w*wwgGRgGcW(X#;Sg}M2Gzk@Jv`!&awRl=wsfGIz`dKZ*T'Y-:RhR7RhQg5u-p`j6v(us5d,#Y+~Awkia?RicOuNBwkibba}Ld6p~tyu_vbAa'a+!a/'a3aEa8a!>Sh,ebJv{!&Sh@ebSaReb9;SgwebNuPRi(NvdRl)NuPRi'hHu^<Rm^Jvv_@Wl(g;u1Si/ebKu'B&!*Sh?eb@Wl'z@aPeb95Si.ebcpputyvjB)!,&a+0a%ShAMWeK@G}C@WfJ9;RhMwvhH9w{ia}ix,hJvRA1(!zAn[MRhHx1hJ~*!#hFv(BSn[MBJQ!(@@=I~'978B2@@=I}2db.Ua<'X}+T#a0XaG2G}E;wkg|wuh!Rh!x,hZu,@)!&So0MVy)C5RiXACJvB!&5RiY5RiZg8w)cG}*T#2@bU}=KsA>(!a.3wkhZba~(x,h^u(A!&(SoCMRhb5Bz=h[eb?w~hb~6x,h_u(A!&(SoDMRhc5Bz=h]eb?w~hc~6e)aA1T#T,^^^c-bMb&blcPaP(a/!0!bA=b5c@a(!bfbrc#2afwmhARnjwchORnp2Wlf3DtsNvdRl-2@wpa<]m0bx(#:awRk2@Jw3!%RfhwpfgRlnKQB%!(G{V@G|'NuuRl6d='T+Y#VyUg<v~Rl~==G|<Jv+'!aYShC}6@B<5?ba~8@Jw3'!g2QRljhLrpWlOd+#Y'g.w'rIg>w*wgj@g-u0Rj@Lu+wT&)ZtUauq]~GrGci&U#F|39:rELrNvj!.%*RhCwunfw~nf~:9;Ri]>wtnhg;wHRnhx3hDs@v~!/+'@Wfr@9RkSNu&Rlo=@<5GzoKs0@_+@Wl+@awRkmJuh!-3d(}pY#qWJvj!%Rm(:Jw3!%Rm,Rm*de&!1U-U#`)Re;@G|.@9Ri82@wjfvRlq=@<5GzpLvOvr!).&2RlF8Rf`C=x!eE{.Jw3_g2QRlkhLrpWlPde(!#U{s,UXa*Ta'[y'g:v>ReS;x0PZ&RnlRnn~HrKJw1}f!=x!eB|2w]aP(#Xa&a*Ta.Ua2a7=]iOd'#Y&Ro&WnWg;u.RiDg6vjRiBNvdRlzhNvj]nYJuW_2Wm3x)kFze{9d])!a.!,Y01!#&aC!a3RndC=ox~BrC@2b^{pg,rlse7x'ksuq!%Rm.E{xidw(wBRmGx9o+)X#wwo-So-}69:Rl4@xSf@a#XZ'X)X,Ta(/ARl8b[xc>RfY:RlI:RfQwlg.ARl:9;Rlwdn'#^XafaQa1X1TaHTa)@b[{zcZ#X'7RkwWg@Ou4ARn&x)kG#{,g7u/RkGdH'U#Y*Vz'Wm&CARm|bx#(A]gUbUzJj9Q~=d,#Y(56H}l978H{U7d,0#U*2>ABb_xZ978BbU{e~AJQ{g!978BbU{hxMh?ad{oUYZ.x1h?{l!#:2<H{mx3n[t{vl!,&a%3Ro(z=iS}6ARnr=Bwsn^wvn`Rnbd`*T}B0!#^X'BG{c9b]{a>>@=be}F?JvS!&BG{d7BG}(Bde#`a1X,Ya@!a'P~=wxf@2bZ}I56B2@@=aybb}08@55B9;5bb}<j3vLv;<Jw3&!>Rfg=ayb^}&OuNBKuLA!)a!P~=x#fD{f2@>==<bbzl?C972@@=Ix^d6rSu,v7w*C(0a)a6#B+a%!sQ[y?3Dt%3[xn~<5rLOu!5p@Ku+D#'!t7~GrP~?rNKvlaya7'!h+v-5qMg=t|cd,U#5AAaa5Abb{S@52B5@a[@52B5Gx[iXueu;d<#`a(!/549C;ag>23ExY5@Dah89b^~689Jv)!~2b[~1Lv'w(%*!a#bX|aPrmawRe]keu7uhv-q6rxu,q`xTo]/a5aU!bNaDXbi!b-!ao!b<bwA!#5@B932:aV2G|:d-)Y#hJrL>RhG<7@C5<H|_=Cau:5aj5@B932:bJ|ng>vIbs)#?C2F|9jPv0w.vISh-MKvUaz(.!9ABbb|[5;5<H|Eg>unwfh;9:4E|YjQsBt|vjx'hYq3!(?C2F|J:2<BaY?C2F|GOu!5x,g|p{ah!-(?C2F|c9:4E|OjXuvvNr}:Rh&i[w*t|cd+U#jJvsu)vsSn~Mkfrmu9p}u7vwv]So!McW#Xa!ax5@A5aY:5;5<H|>kJv~vYrquJu3x4ib#T)2@SmZM?C2F|Bj:rmu9@xPhI(a*a#U#`a3-5Abb|L~@:RhK9:4E|0@52B5G|#C::aY?C2F|-:2<BaY?C2F|.5Jvk!a)javYrquJu3x4ia#T)2@SmYM?C2F|HAxPhH(!a#U#`a*-5Abb|4~@:RhJ9:4E|R@52B5G|F:2<BaY?C2F|Sc^#Xa2j=Qq5CJvB!-g<v{z;hhM?C2F|Zi[vrv{z;hiM?C2F|XKsA>!a)-g<v{z;h[eb?C2F|]i[vrv{z;h]eb?C2F|^iZu.vix,hZq3ah!.(?C2F|QOu!5ShXM:2<BaY?C2F|P", 13494, 2713, 49, 25, 61);
  }
});

// node_modules/entities/dist/generated/decode-data-xml.js
var xmlDecodeTree;
var init_decode_data_xml = __esm({
  "node_modules/entities/dist/generated/decode-data-xml.js"() {
    xmlDecodeTree = /* @__PURE__ */ new Uint16Array([
      512,
      26465,
      29036,
      7,
      0,
      2,
      4,
      116,
      24638,
      116,
      24636,
      8693,
      29807,
      24610,
      621,
      1,
      0,
      0,
      3,
      112,
      24614,
      111,
      115,
      24615
    ]);
  }
});

// node_modules/entities/dist/internal/bin-trie-flags.js
var BinTrieFlags;
var init_bin_trie_flags = __esm({
  "node_modules/entities/dist/internal/bin-trie-flags.js"() {
    (function(BinTrieFlags2) {
      BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
      BinTrieFlags2[BinTrieFlags2["FLAG13"] = 8192] = "FLAG13";
      BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
      BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
      BinTrieFlags2[BinTrieFlags2["VALUE_MASK"] = 8191] = "VALUE_MASK";
    })(BinTrieFlags || (BinTrieFlags = {}));
  }
});

// node_modules/entities/dist/decode.js
function unpackConsumed(packed) {
  const consumed = packed >>> CONSUMED_SHIFT;
  return consumed === CONSUMED_OVERFLOW ? longNumericConsumed : consumed;
}
function isNumber(code2) {
  return code2 - CharCodes.ZERO >>> 0 <= 9;
}
function isHexadecimalCharacter(code2) {
  return (code2 | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 5;
}
function isAlpha(code2) {
  return (code2 | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 25;
}
function isEntityInAttributeInvalidEnd(code2) {
  return code2 === CharCodes.EQUALS || isAlpha(code2) || isNumber(code2);
}
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (jumpOffset) {
    if (branchCount === 0) {
      return char === jumpOffset ? nodeIndex : -1;
    }
    const slot = char - jumpOffset;
    if (slot >>> 0 >= branchCount)
      return -1;
    const stored = decodeTree[nodeIndex + slot];
    return stored === 0 ? -1 : nodeIndex + branchCount + stored - 1 & 65535;
  }
  if (branchCount === 0)
    return -1;
  const packedKeySlots = branchCount + 1 >> 1;
  const branchEnd = nodeIndex + packedKeySlots + branchCount;
  for (let index = 0; index < branchCount; index++) {
    const packed = decodeTree[nodeIndex + (index >> 1)];
    const key = packed >> ((index & 1) << 3) & 255;
    if (key === char) {
      const pointerIndex = nodeIndex + packedKeySlots + index;
      return branchEnd + decodeTree[pointerIndex] & 65535;
    }
    if (key > char)
      return -1;
  }
  return -1;
}
function readTrieValue(decodeTree, nodeIndex, valueLength) {
  if (valueLength === 1) {
    return String.fromCharCode(decodeTree[nodeIndex] & BinTrieFlags.VALUE_MASK);
  }
  if (valueLength === 2) {
    return String.fromCharCode(decodeTree[nodeIndex + 1]);
  }
  return String.fromCharCode(decodeTree[nodeIndex + 1], decodeTree[nodeIndex + 2]);
}
function parseNumericEntity(input, numberStart, inputLength) {
  let offset = numberStart + 1;
  let cp = 0;
  let digitStart = offset;
  if (offset < inputLength && (input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
    offset += 1;
    digitStart = offset;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber(char)) {
        cp = cp * 16 + (char - CharCodes.ZERO);
      } else if (isHexadecimalCharacter(char)) {
        cp = cp * 16 + ((char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10);
      } else {
        break;
      }
      offset += 1;
    }
  } else {
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes.ZERO;
      if (digit >>> 0 > 9)
        break;
      cp = cp * 10 + digit;
      offset += 1;
    }
  }
  if (offset === digitStart)
    return 0;
  if (offset < inputLength && input.charCodeAt(offset) === CharCodes.SEMI) {
    offset += 1;
  }
  if (cp > 1114111)
    cp = 1114112;
  let consumed = offset - numberStart;
  if (consumed >= CONSUMED_OVERFLOW) {
    longNumericConsumed = consumed;
    consumed = CONSUMED_OVERFLOW;
  }
  return consumed << CONSUMED_SHIFT | cp;
}
function decodeWithTrie(input, isStrict, isAttribute) {
  const decodeTree = htmlDecodeTree;
  let offset = input.indexOf("&");
  if (offset < 0)
    return input;
  const inputLength = input.length;
  let chunkStart = 0;
  let result = "";
  const root = decodeTree[0];
  const rootJumpOffset = root & BinTrieFlags.JUMP_TABLE;
  const rootBranchCount = (root & BinTrieFlags.BRANCH_LENGTH) >> 7;
  do {
    const entityStart = offset + 1;
    const firstChar = input.charCodeAt(entityStart);
    let consumed;
    let value;
    if (firstChar === CharCodes.NUM) {
      const packed = parseNumericEntity(input, entityStart, inputLength);
      consumed = unpackConsumed(packed);
      if (isStrict && consumed > 0 && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI) {
        consumed = 0;
      }
      value = consumed === 0 ? "" : codePointToString(packed & CODE_POINT_MASK);
    } else if (isAlpha(firstChar)) {
      consumed = 0;
      value = "";
      const rootSlotIndex = firstChar - rootJumpOffset;
      let nodeIndex;
      if (rootSlotIndex >>> 0 < rootBranchCount) {
        const stored = decodeTree[1 + rootSlotIndex];
        nodeIndex = stored === 0 ? -1 : rootBranchCount + stored & 65535;
      } else {
        nodeIndex = -1;
      }
      let bestNodeIndex = 0;
      let bestValueLength = 0;
      let current = nodeIndex < 0 ? 0 : decodeTree[nodeIndex];
      let index = entityStart + 1;
      trie: while (index < inputLength) {
        while (
          // Value-less, non-run node with a nonzero jump offset.
          (current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0
        ) {
          const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
          const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
          if (branchCount === 0) {
            if (input.charCodeAt(index) !== jumpOffset)
              break trie;
            nodeIndex += 1;
          } else {
            const slot = input.charCodeAt(index) - jumpOffset;
            if (slot >>> 0 >= branchCount)
              break trie;
            const stored = decodeTree[nodeIndex + 1 + slot];
            if (stored === 0)
              break trie;
            nodeIndex = nodeIndex + branchCount + stored & 65535;
          }
          current = decodeTree[nodeIndex];
          index += 1;
          if (index >= inputLength)
            break trie;
        }
        if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
          const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
          if (input.charCodeAt(index) !== (current & BinTrieFlags.JUMP_TABLE)) {
            break;
          }
          index += 1;
          const remaining = runLength - 1;
          let wordIndex = nodeIndex + 1;
          let charIndexInPacked = 0;
          for (; charIndexInPacked + 1 < remaining; charIndexInPacked += 2) {
            const packed = decodeTree[wordIndex];
            if (input.charCodeAt(index) !== (packed & 255))
              break trie;
            index += 1;
            if (input.charCodeAt(index) !== (packed >> 8 & 255))
              break trie;
            index += 1;
            wordIndex += 1;
          }
          if (charIndexInPacked < remaining) {
            if (input.charCodeAt(index) !== (decodeTree[wordIndex] & 255))
              break;
            index += 1;
          }
          nodeIndex += 1 + (runLength >> 1);
          current = decodeTree[nodeIndex];
          continue;
        }
        const valueLength = current >>> 14;
        const char = input.charCodeAt(index);
        if (valueLength !== 0) {
          if (char === CharCodes.SEMI) {
            consumed = index - entityStart + 1;
            value = valueLength === 1 ? String.fromCharCode(current & BinTrieFlags.VALUE_MASK) : readTrieValue(decodeTree, nodeIndex, valueLength);
            break;
          }
          if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
            consumed = index - entityStart;
            bestNodeIndex = nodeIndex;
            bestValueLength = valueLength;
          }
          if (valueLength === 1)
            break;
        }
        const next = determineBranch(decodeTree, current, nodeIndex + (valueLength || 1), char);
        if (next < 0)
          break;
        nodeIndex = next;
        current = decodeTree[nodeIndex];
        index += 1;
      }
      if (value === "") {
        const finalVL = current >>> 14;
        if (finalVL !== 0 && !isStrict && (current & BinTrieFlags.FLAG13) === 0) {
          consumed = index - entityStart;
          bestNodeIndex = nodeIndex;
          bestValueLength = finalVL;
        }
        if (consumed > 0) {
          value = readTrieValue(decodeTree, bestNodeIndex, bestValueLength);
        }
      }
    } else {
      consumed = 0;
      value = "";
    }
    if (consumed === 0 || isAttribute && firstChar !== CharCodes.NUM && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI && entityStart + consumed < inputLength && isEntityInAttributeInvalidEnd(input.charCodeAt(entityStart + consumed))) {
      offset = entityStart;
    } else {
      if (chunkStart < offset) {
        result += input.slice(chunkStart, offset);
      }
      result += value;
      offset = chunkStart = entityStart + consumed;
    }
    if (input.charCodeAt(offset) !== CharCodes.AMP) {
      offset = input.indexOf("&", offset);
    }
  } while (offset >= 0);
  return result + input.slice(chunkStart);
}
function decodeHTMLStrict(htmlString) {
  return decodeWithTrie(htmlString, true, false);
}
var CharCodes, TO_LOWER_BIT, CONSUMED_SHIFT, CODE_POINT_MASK, CONSUMED_OVERFLOW, longNumericConsumed, EntityDecoderState, DecodingMode, EntityDecoder;
var init_decode = __esm({
  "node_modules/entities/dist/decode.js"() {
    init_decode_codepoint();
    init_decode_data_html();
    init_decode_data_xml();
    init_bin_trie_flags();
    init_decode_data_html();
    init_decode_data_xml();
    (function(CharCodes3) {
      CharCodes3[CharCodes3["AMP"] = 38] = "AMP";
      CharCodes3[CharCodes3["NUM"] = 35] = "NUM";
      CharCodes3[CharCodes3["SEMI"] = 59] = "SEMI";
      CharCodes3[CharCodes3["EQUALS"] = 61] = "EQUALS";
      CharCodes3[CharCodes3["ZERO"] = 48] = "ZERO";
      CharCodes3[CharCodes3["NINE"] = 57] = "NINE";
      CharCodes3[CharCodes3["LOWER_A"] = 97] = "LOWER_A";
      CharCodes3[CharCodes3["LOWER_X"] = 120] = "LOWER_X";
    })(CharCodes || (CharCodes = {}));
    TO_LOWER_BIT = 32;
    CONSUMED_SHIFT = 21;
    CODE_POINT_MASK = 2097151;
    CONSUMED_OVERFLOW = 2047;
    longNumericConsumed = 0;
    (function(EntityDecoderState2) {
      EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
      EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
      EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
      EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
      EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
    })(EntityDecoderState || (EntityDecoderState = {}));
    (function(DecodingMode2) {
      DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
      DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
      DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
    })(DecodingMode || (DecodingMode = {}));
    EntityDecoder = class {
      decodeTree;
      emitCodePoint;
      errors;
      /** The current state of the decoder. */
      state = EntityDecoderState.EntityStart;
      /** Characters that were consumed while parsing an entity. */
      consumed = 1;
      /**
       * The result of the entity.
       *
       * For named entities: the trie index of the best legacy match so far
       * (0 = none). For numeric entities: the accumulated code point.
       */
      result = 0;
      /** The current index in the decode tree. */
      treeIndex = 0;
      /**
       * Characters consumed since the last recorded legacy match, plus one.
       * Invariant at the top of the `stateNamedEntity` loop: `excess` equals
       * the number of unrecorded consumed characters + 1.
       */
      // biome-ignore lint/correctness/noUnusedPrivateClassMembers: False positive (read via destructuring)
      excess = 1;
      /** The mode in which the decoder is operating. */
      decodeMode = DecodingMode.Strict;
      /** The number of characters that have been consumed in the current run. */
      // biome-ignore lint/correctness/noUnusedPrivateClassMembers: False positive
      runConsumed = 0;
      constructor(decodeTree, emitCodePoint, errors2) {
        this.decodeTree = decodeTree;
        this.emitCodePoint = emitCodePoint;
        this.errors = errors2;
      }
      /**
       * Resets the instance to make it reusable.
       * @param decodeMode Entity decoding mode to use.
       */
      startEntity(decodeMode) {
        this.decodeMode = decodeMode;
        this.state = EntityDecoderState.EntityStart;
        this.result = 0;
        this.treeIndex = 0;
        this.excess = 1;
        this.consumed = 1;
        this.runConsumed = 0;
      }
      /**
       * Write an entity to the decoder. This can be called multiple times with partial entities.
       * If the entity is incomplete, the decoder will return -1.
       *
       * Mirrors the non-streaming `decodeWithTrie`, but with the ability to stop decoding if the
       * entity is incomplete, and resume when the next string is written.
       * @param input The string containing the entity (or a continuation of the entity).
       * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
       * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
       */
      write(input, offset) {
        switch (this.state) {
          case EntityDecoderState.EntityStart: {
            if (input.charCodeAt(offset) === CharCodes.NUM) {
              this.state = EntityDecoderState.NumericStart;
              this.consumed += 1;
              return this.stateNumericStart(input, offset + 1);
            }
            this.state = EntityDecoderState.NamedEntity;
            return this.stateNamedEntity(input, offset);
          }
          case EntityDecoderState.NumericStart: {
            return this.stateNumericStart(input, offset);
          }
          case EntityDecoderState.NumericDecimal: {
            return this.stateNumericDecimal(input, offset);
          }
          case EntityDecoderState.NumericHex: {
            return this.stateNumericHex(input, offset);
          }
          default: {
            return this.stateNamedEntity(input, offset);
          }
        }
      }
      /**
       * Switches between the numeric decimal and hexadecimal states.
       *
       * Equivalent to the `Numeric character reference state` in the HTML spec.
       * @param input The string containing the entity (or a continuation of the entity).
       * @param offset The current offset.
       * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
       */
      // eslint-disable-next-line unicorn/consistent-class-member-order
      stateNumericStart(input, offset) {
        if (offset >= input.length) {
          return -1;
        }
        if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
          this.state = EntityDecoderState.NumericHex;
          this.consumed += 1;
          return this.stateNumericHex(input, offset + 1);
        }
        this.state = EntityDecoderState.NumericDecimal;
        return this.stateNumericDecimal(input, offset);
      }
      /**
       * Parses a hexadecimal numeric entity.
       *
       * Equivalent to the `Hexademical character reference state` in the HTML
       * spec. Digit parsing matches the hex loop in `parseNumericEntity`.
       * The accumulated value is preserved for numeric validation callbacks.
       * @param input The string containing the entity (or a continuation of the entity).
       * @param offset The current offset.
       * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
       */
      stateNumericHex(input, offset) {
        const inputLength = input.length;
        let { result } = this;
        let { consumed } = this;
        while (offset < inputLength) {
          const char = input.charCodeAt(offset);
          if (isNumber(char) || isHexadecimalCharacter(char)) {
            const digit = char <= CharCodes.NINE ? char - CharCodes.ZERO : (char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10;
            result = result * 16 + digit;
            consumed += 1;
            offset += 1;
          } else {
            this.result = result;
            this.consumed = consumed;
            return this.emitNumericEntity(char, 3);
          }
        }
        this.result = result;
        this.consumed = consumed;
        return -1;
      }
      /**
       * Parses a decimal numeric entity.
       *
       * Equivalent to the `Decimal character reference state` in the HTML
       * spec. Digit parsing matches the decimal loop in `parseNumericEntity`.
       * The accumulated value is preserved for numeric validation callbacks.
       * @param input The string containing the entity (or a continuation of the entity).
       * @param offset The current offset.
       * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
       */
      stateNumericDecimal(input, offset) {
        const inputLength = input.length;
        let { result } = this;
        let { consumed } = this;
        while (offset < inputLength) {
          const digit = input.charCodeAt(offset) - CharCodes.ZERO;
          if (digit >>> 0 > 9) {
            this.result = result;
            this.consumed = consumed;
            return this.emitNumericEntity(digit + CharCodes.ZERO, 2);
          }
          result = result * 10 + digit;
          consumed += 1;
          offset += 1;
        }
        this.result = result;
        this.consumed = consumed;
        return -1;
      }
      /**
       * Validate and emit a numeric entity.
       *
       * Implements the logic from the `Hexademical character reference start
       * state` and `Numeric character reference end state` in the HTML spec.
       * @param lastCp The last code point of the entity. Used to see if the
       *               entity was terminated with a semicolon.
       * @param expectedLength The minimum number of characters that should be
       *                       consumed. Used to validate that at least one digit
       *                       was consumed.
       * @returns The number of characters that were consumed.
       */
      emitNumericEntity(lastCp, expectedLength) {
        if (this.consumed <= expectedLength) {
          this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
          return 0;
        }
        if (lastCp === CharCodes.SEMI) {
          this.consumed += 1;
        } else if (this.decodeMode === DecodingMode.Strict) {
          return 0;
        }
        this.emitCodePoint((this.decodeTree === xmlDecodeTree ? replaceCodePointXML : replaceCodePoint)(this.result), this.consumed);
        if (this.errors) {
          if (lastCp !== CharCodes.SEMI) {
            this.errors.missingSemicolonAfterCharacterReference();
          }
          this.errors.validateNumericCharacterReference(this.result);
        }
        return this.consumed;
      }
      /**
       * Flush locally-tracked walk state back to the fields, then emit the
       * recorded legacy match or reject (cold path — at most once per
       * entity). Called after failed navigation (leaf node, branch miss, or
       * compact-run mismatch). In attribute mode, reject if no legacy was
       * recorded at the current node, if we descended past it, or if the
       * pending input character is an invalid attribute terminator.
       * @param consumed Locally-tracked consumed count.
       * @param excess Locally-tracked excess count.
       * @param char Pending input character (may be the mismatching char).
       * @param valueLength Value length at the current trie node.
       */
      flushAndEmitLegacyOrReject(consumed, excess, char, valueLength) {
        this.consumed = consumed;
        this.excess = excess;
        return this.result === 0 || this.decodeMode === DecodingMode.Attribute && (valueLength === 0 || excess > 1 || isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
      }
      /**
       * Parses a named entity.
       *
       * Equivalent to the `Named character reference state` in the HTML spec.
       * @param input The string containing the entity (or a continuation of the entity).
       * @param offset The current offset.
       * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
       */
      stateNamedEntity(input, offset) {
        const { decodeTree } = this;
        const inputLength = input.length;
        const isStrict = this.decodeMode === DecodingMode.Strict;
        let { treeIndex } = this;
        let { excess } = this;
        let { consumed } = this;
        let current = decodeTree[treeIndex];
        while (offset < inputLength) {
          while ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0) {
            const char2 = input.charCodeAt(offset);
            const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
            const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
            if (branchCount === 0) {
              if (char2 !== jumpOffset) {
                return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
              }
              treeIndex += 1;
            } else {
              const slot = char2 - jumpOffset;
              if (slot >>> 0 >= branchCount) {
                return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
              }
              const stored = decodeTree[treeIndex + 1 + slot];
              if (stored === 0) {
                return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
              }
              treeIndex = treeIndex + branchCount + stored & 65535;
            }
            current = decodeTree[treeIndex];
            offset += 1;
            excess += 1;
            if (offset >= inputLength)
              break;
          }
          if (offset >= inputLength)
            break;
          if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
            const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
            let { runConsumed } = this;
            if (runConsumed === 0) {
              const char2 = input.charCodeAt(offset);
              if (char2 !== (current & BinTrieFlags.JUMP_TABLE)) {
                return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
              }
              offset += 1;
              excess += 1;
              runConsumed = 1;
            }
            while (runConsumed < runLength) {
              if (offset >= inputLength) {
                this.treeIndex = treeIndex;
                this.excess = excess;
                this.consumed = consumed;
                this.runConsumed = runConsumed;
                return -1;
              }
              const charIndexInPacked = runConsumed - 1;
              const packedWord = decodeTree[treeIndex + 1 + (charIndexInPacked >> 1)];
              const expectedChar = packedWord >> ((charIndexInPacked & 1) << 3) & 255;
              const char2 = input.charCodeAt(offset);
              if (char2 !== expectedChar) {
                this.runConsumed = 0;
                return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
              }
              offset += 1;
              excess += 1;
              runConsumed += 1;
            }
            this.runConsumed = 0;
            treeIndex += 1 + (runLength >> 1);
            current = decodeTree[treeIndex];
            continue;
          }
          const valueLength = current >>> 14;
          const char = input.charCodeAt(offset);
          if (valueLength !== 0) {
            if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
              this.result = treeIndex;
              consumed += excess - 1;
              excess = 1;
            }
            if (char === CharCodes.SEMI) {
              return this.emitNamedEntityData(treeIndex, valueLength, consumed + excess);
            }
            if (valueLength === 1) {
              return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
            }
          }
          const next = determineBranch(decodeTree, current, treeIndex + (valueLength || 1), char);
          if (next < 0) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
          }
          treeIndex = next;
          current = decodeTree[treeIndex];
          offset += 1;
          excess += 1;
        }
        if (!isStrict && current >>> 14 !== 0 && (current & BinTrieFlags.FLAG13) === 0) {
          this.result = treeIndex;
          consumed += excess - 1;
          excess = 1;
        }
        this.treeIndex = treeIndex;
        this.excess = excess;
        this.consumed = consumed;
        return -1;
      }
      /**
       * Emit a named entity that was not terminated with a semicolon.
       * @returns The number of characters consumed.
       */
      emitNotTerminatedNamedEntity() {
        const { result, decodeTree } = this;
        const valueLength = decodeTree[result] >>> 14;
        this.emitNamedEntityData(result, valueLength, this.consumed);
        this.errors?.missingSemicolonAfterCharacterReference();
        return this.consumed;
      }
      /**
       * Emit a named entity.
       * @param result The index of the entity in the decode tree.
       * @param valueLength Encoded value length (header plus any value words).
       * @param consumed The number of characters consumed.
       * @returns The number of characters consumed.
       */
      emitNamedEntityData(result, valueLength, consumed) {
        const { decodeTree } = this;
        this.emitCodePoint(valueLength === 1 ? decodeTree[result] & BinTrieFlags.VALUE_MASK : decodeTree[result + 1], consumed);
        if (valueLength === 3) {
          this.emitCodePoint(decodeTree[result + 2], consumed);
        }
        return consumed;
      }
      /**
       * Signal to the parser that the end of the input was reached.
       *
       * Remaining data will be emitted and relevant errors will be produced.
       * @returns The number of characters consumed.
       */
      end() {
        switch (this.state) {
          case EntityDecoderState.NamedEntity: {
            return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
          }
          // Otherwise, emit a numeric entity if we have one.
          case EntityDecoderState.NumericDecimal: {
            return this.emitNumericEntity(0, 2);
          }
          case EntityDecoderState.NumericHex: {
            return this.emitNumericEntity(0, 3);
          }
          case EntityDecoderState.NumericStart: {
            this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
            return 0;
          }
          default: {
            return 0;
          }
        }
      }
    };
  }
});

// node_modules/entities/dist/escape.js
function getEscape(char) {
  return char === 34 ? "&quot;" : char === 38 ? "&amp;" : char === 39 ? "&apos;" : char === 60 ? "&lt;" : char === 62 ? "&gt;" : "&nbsp;";
}
function isXmlEscapable(code2) {
  return code2 >= 128 || code2 >= 32 && code2 < 64 && (XML_BITSET_VALUE >>> code2 & 1) === 1;
}
function encodeXML(input) {
  const { length } = input;
  let out;
  let last = 0;
  let index = 0;
  while (index < length) {
    const char = input.charCodeAt(index);
    if (!isXmlEscapable(char)) {
      const bound = Math.min(index + 32, length);
      let next = index + 1;
      while (next < bound && !isXmlEscapable(input.charCodeAt(next))) {
        next++;
      }
      if (next < bound) {
        index = next;
        continue;
      }
      if (next >= length)
        break;
      xmlEncodeRegex.lastIndex = next;
      if (!xmlEncodeRegex.test(input))
        break;
      index = xmlEncodeRegex.lastIndex - 1;
      continue;
    }
    if (out === void 0)
      out = input.substring(0, index);
    else if (last !== index)
      out += input.substring(last, index);
    if (char < 64) {
      out += getEscape(char);
      last = index += 1;
      continue;
    }
    const cp = input.codePointAt(index);
    out += `&#x${cp.toString(16)};`;
    if (cp !== char)
      index++;
    last = index += 1;
  }
  if (out === void 0)
    return input;
  if (last < length)
    out += input.substr(last);
  return out;
}
function escapeWithRegex(re, data) {
  re.lastIndex = 0;
  if (!re.test(data))
    return data;
  let out = "";
  let last = 0;
  do {
    const index = re.lastIndex - 1;
    if (last !== index)
      out += data.substring(last, index);
    const char = data.charCodeAt(index);
    out += getEscape(char);
    last = index + 1;
  } while (re.test(data));
  return out + data.substring(last);
}
function escapeAttribute(data) {
  return escapeWithRegex(attributeEscapeRegex, data);
}
function escapeText(data) {
  return escapeWithRegex(textEscapeRegex, data);
}
var XML_BITSET_VALUE, xmlEncodeRegex, attributeEscapeRegex, textEscapeRegex;
var init_escape = __esm({
  "node_modules/entities/dist/escape.js"() {
    XML_BITSET_VALUE = 1342177476;
    xmlEncodeRegex = /["&'<>\u0080-\uFFFF]/g;
    attributeEscapeRegex = /["&\u{A0}]/gu;
    textEscapeRegex = /[&<>\u{A0}]/gu;
  }
});

// node_modules/entities/dist/index.js
var EntityLevel, EncodingMode;
var init_dist = __esm({
  "node_modules/entities/dist/index.js"() {
    init_decode();
    init_escape();
    (function(EntityLevel2) {
      EntityLevel2[EntityLevel2["XML"] = 0] = "XML";
      EntityLevel2[EntityLevel2["HTML"] = 1] = "HTML";
    })(EntityLevel || (EntityLevel = {}));
    (function(EncodingMode2) {
      EncodingMode2[EncodingMode2["UTF8"] = 0] = "UTF8";
      EncodingMode2[EncodingMode2["ASCII"] = 1] = "ASCII";
      EncodingMode2[EncodingMode2["Extensive"] = 2] = "Extensive";
      EncodingMode2[EncodingMode2["Attribute"] = 3] = "Attribute";
      EncodingMode2[EncodingMode2["Text"] = 4] = "Text";
    })(EncodingMode || (EncodingMode = {}));
  }
});

// node_modules/htmlparser2/dist/Tokenizer.js
function isWhitespace(c) {
  return c === CharCodes2.Space || c === CharCodes2.NewLine || c === CharCodes2.Tab || c === CharCodes2.FormFeed || c === CharCodes2.CarriageReturn;
}
function isEndOfTagSection(c) {
  return c === CharCodes2.Slash || c === CharCodes2.Gt || isWhitespace(c);
}
function isASCIIAlpha(c) {
  return c >= CharCodes2.LowerA && c <= CharCodes2.LowerZ || c >= CharCodes2.UpperA && c <= CharCodes2.UpperZ;
}
var CharCodes2, State, QuoteType, Sequences, specialStartSequences, Tokenizer;
var init_Tokenizer = __esm({
  "node_modules/htmlparser2/dist/Tokenizer.js"() {
    init_decode();
    (function(CharCodes3) {
      CharCodes3[CharCodes3["Tab"] = 9] = "Tab";
      CharCodes3[CharCodes3["NewLine"] = 10] = "NewLine";
      CharCodes3[CharCodes3["FormFeed"] = 12] = "FormFeed";
      CharCodes3[CharCodes3["CarriageReturn"] = 13] = "CarriageReturn";
      CharCodes3[CharCodes3["Space"] = 32] = "Space";
      CharCodes3[CharCodes3["ExclamationMark"] = 33] = "ExclamationMark";
      CharCodes3[CharCodes3["Number"] = 35] = "Number";
      CharCodes3[CharCodes3["Amp"] = 38] = "Amp";
      CharCodes3[CharCodes3["SingleQuote"] = 39] = "SingleQuote";
      CharCodes3[CharCodes3["DoubleQuote"] = 34] = "DoubleQuote";
      CharCodes3[CharCodes3["Dash"] = 45] = "Dash";
      CharCodes3[CharCodes3["Slash"] = 47] = "Slash";
      CharCodes3[CharCodes3["Zero"] = 48] = "Zero";
      CharCodes3[CharCodes3["Nine"] = 57] = "Nine";
      CharCodes3[CharCodes3["Semi"] = 59] = "Semi";
      CharCodes3[CharCodes3["Lt"] = 60] = "Lt";
      CharCodes3[CharCodes3["Eq"] = 61] = "Eq";
      CharCodes3[CharCodes3["Gt"] = 62] = "Gt";
      CharCodes3[CharCodes3["Questionmark"] = 63] = "Questionmark";
      CharCodes3[CharCodes3["UpperA"] = 65] = "UpperA";
      CharCodes3[CharCodes3["LowerA"] = 97] = "LowerA";
      CharCodes3[CharCodes3["UpperF"] = 70] = "UpperF";
      CharCodes3[CharCodes3["LowerF"] = 102] = "LowerF";
      CharCodes3[CharCodes3["UpperZ"] = 90] = "UpperZ";
      CharCodes3[CharCodes3["LowerZ"] = 122] = "LowerZ";
      CharCodes3[CharCodes3["LowerX"] = 120] = "LowerX";
      CharCodes3[CharCodes3["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
    })(CharCodes2 || (CharCodes2 = {}));
    (function(State2) {
      State2[State2["Text"] = 1] = "Text";
      State2[State2["BeforeTagName"] = 2] = "BeforeTagName";
      State2[State2["InTagName"] = 3] = "InTagName";
      State2[State2["InSelfClosingTag"] = 4] = "InSelfClosingTag";
      State2[State2["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
      State2[State2["InClosingTagName"] = 6] = "InClosingTagName";
      State2[State2["AfterClosingTagName"] = 7] = "AfterClosingTagName";
      State2[State2["BeforeAttributeName"] = 8] = "BeforeAttributeName";
      State2[State2["InAttributeName"] = 9] = "InAttributeName";
      State2[State2["AfterAttributeName"] = 10] = "AfterAttributeName";
      State2[State2["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
      State2[State2["InAttributeValueDq"] = 12] = "InAttributeValueDq";
      State2[State2["InAttributeValueSq"] = 13] = "InAttributeValueSq";
      State2[State2["InAttributeValueNq"] = 14] = "InAttributeValueNq";
      State2[State2["BeforeDeclaration"] = 15] = "BeforeDeclaration";
      State2[State2["InDeclaration"] = 16] = "InDeclaration";
      State2[State2["InProcessingInstruction"] = 17] = "InProcessingInstruction";
      State2[State2["BeforeComment"] = 18] = "BeforeComment";
      State2[State2["CDATASequence"] = 19] = "CDATASequence";
      State2[State2["DeclarationSequence"] = 20] = "DeclarationSequence";
      State2[State2["InSpecialComment"] = 21] = "InSpecialComment";
      State2[State2["InCommentLike"] = 22] = "InCommentLike";
      State2[State2["SpecialStartSequence"] = 23] = "SpecialStartSequence";
      State2[State2["InSpecialTag"] = 24] = "InSpecialTag";
      State2[State2["InPlainText"] = 25] = "InPlainText";
      State2[State2["InEntity"] = 26] = "InEntity";
    })(State || (State = {}));
    (function(QuoteType2) {
      QuoteType2[QuoteType2["NoValue"] = 0] = "NoValue";
      QuoteType2[QuoteType2["Unquoted"] = 1] = "Unquoted";
      QuoteType2[QuoteType2["Single"] = 2] = "Single";
      QuoteType2[QuoteType2["Double"] = 3] = "Double";
    })(QuoteType || (QuoteType = {}));
    Sequences = {
      Empty: new Uint8Array(0),
      Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
      // CDATA[
      CdataEnd: new Uint8Array([93, 93, 62]),
      // ]]>
      CommentEnd: new Uint8Array([45, 45, 33, 62]),
      // `--!>`
      Doctype: new Uint8Array([100, 111, 99, 116, 121, 112, 101]),
      // `doctype`
      IframeEnd: new Uint8Array([60, 47, 105, 102, 114, 97, 109, 101]),
      // `</iframe`
      NoembedEnd: new Uint8Array([
        60,
        47,
        110,
        111,
        101,
        109,
        98,
        101,
        100
      ]),
      // `</noembed`
      NoframesEnd: new Uint8Array([
        60,
        47,
        110,
        111,
        102,
        114,
        97,
        109,
        101,
        115
      ]),
      // `</noframes`
      Plaintext: new Uint8Array([
        60,
        47,
        112,
        108,
        97,
        105,
        110,
        116,
        101,
        120,
        116
      ]),
      // `</plaintext`
      ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
      // `</script`
      StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
      // `</style`
      TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101]),
      // `</title`
      TextareaEnd: new Uint8Array([
        60,
        47,
        116,
        101,
        120,
        116,
        97,
        114,
        101,
        97
      ]),
      // `</textarea`
      XmpEnd: new Uint8Array([60, 47, 120, 109, 112])
      // `</xmp`
    };
    specialStartSequences = /* @__PURE__ */ new Map([
      [Sequences.IframeEnd[2], Sequences.IframeEnd],
      [Sequences.NoembedEnd[2], Sequences.NoembedEnd],
      [Sequences.Plaintext[2], Sequences.Plaintext],
      [Sequences.ScriptEnd[2], Sequences.ScriptEnd],
      [Sequences.TitleEnd[2], Sequences.TitleEnd],
      [Sequences.XmpEnd[2], Sequences.XmpEnd]
    ]);
    Tokenizer = class {
      cbs;
      /** The current state the tokenizer is in. */
      state = State.Text;
      /** The read buffer. */
      buffer = "";
      /** The beginning of the section that is currently being read. */
      sectionStart = 0;
      /** The index within the buffer that we are currently looking at. */
      index = 0;
      /** The start of the last entity. */
      entityStart = 0;
      /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
      baseState = State.Text;
      /** For special parsing behavior inside of script and style tags. */
      isSpecial = false;
      /** Indicates whether the tokenizer has been paused. */
      running = true;
      /** The offset of the current buffer. */
      offset = 0;
      xmlMode;
      decodeEntities;
      recognizeSelfClosing;
      entityDecoder;
      constructor({ xmlMode = false, decodeEntities = true, recognizeSelfClosing = xmlMode }, cbs) {
        this.cbs = cbs;
        this.xmlMode = xmlMode;
        this.decodeEntities = decodeEntities;
        this.recognizeSelfClosing = recognizeSelfClosing;
        this.entityDecoder = new EntityDecoder(xmlMode ? xmlDecodeTree : htmlDecodeTree, (cp, consumed) => this.emitCodePoint(cp, consumed));
      }
      reset() {
        this.state = State.Text;
        this.buffer = "";
        this.sectionStart = 0;
        this.index = 0;
        this.baseState = State.Text;
        this.isSpecial = false;
        this.currentSequence = Sequences.Empty;
        this.sequenceIndex = 0;
        this.running = true;
        this.offset = 0;
      }
      write(chunk) {
        this.offset += this.buffer.length;
        this.buffer = chunk;
        this.parse();
      }
      end() {
        if (this.running)
          this.finish();
      }
      pause() {
        this.running = false;
      }
      resume() {
        this.running = true;
        if (this.index < this.buffer.length + this.offset) {
          this.parse();
        }
      }
      stateText(c) {
        if (c === CharCodes2.Lt || !this.decodeEntities && this.fastForwardTo(CharCodes2.Lt)) {
          if (this.index > this.sectionStart) {
            this.cbs.ontext(this.sectionStart, this.index);
          }
          this.state = State.BeforeTagName;
          this.sectionStart = this.index;
        } else if (this.decodeEntities && c === CharCodes2.Amp) {
          this.startEntity();
        }
      }
      currentSequence = Sequences.Empty;
      sequenceIndex = 0;
      enterTagBody() {
        if (this.currentSequence === Sequences.Plaintext) {
          this.currentSequence = Sequences.Empty;
          this.state = State.InPlainText;
        } else if (this.isSpecial) {
          this.state = State.InSpecialTag;
          this.sequenceIndex = 0;
        } else {
          this.state = State.Text;
        }
      }
      /**
       * Match the opening tag name against an HTML text-only tag sequence.
       *
       * Some tags share an initial prefix (`script`/`style`, `title`/`textarea`,
       * `noembed`/`noframes`), so we may switch to an alternate sequence at the
       * first distinguishing byte.  On a successful full match we fall back to
       * the normal tag-name state; a later `>` will enter raw-text, RCDATA, or
       * plaintext mode based on `currentSequence` / `isSpecial`.
       * @param c Current character code point.
       */
      stateSpecialStartSequence(c) {
        const lower = c | 32;
        if (this.sequenceIndex < this.currentSequence.length) {
          if (lower === this.currentSequence[this.sequenceIndex]) {
            this.sequenceIndex++;
            return;
          }
          if (this.sequenceIndex === 3) {
            if (this.currentSequence === Sequences.ScriptEnd && lower === Sequences.StyleEnd[3]) {
              this.currentSequence = Sequences.StyleEnd;
              this.sequenceIndex = 4;
              return;
            }
            if (this.currentSequence === Sequences.TitleEnd && lower === Sequences.TextareaEnd[3]) {
              this.currentSequence = Sequences.TextareaEnd;
              this.sequenceIndex = 4;
              return;
            }
          } else if (this.sequenceIndex === 4 && this.currentSequence === Sequences.NoembedEnd && lower === Sequences.NoframesEnd[4]) {
            this.currentSequence = Sequences.NoframesEnd;
            this.sequenceIndex = 5;
            return;
          }
        } else if (isEndOfTagSection(c)) {
          this.sequenceIndex = 0;
          this.state = State.InTagName;
          this.stateInTagName(c);
          return;
        }
        this.isSpecial = false;
        this.currentSequence = Sequences.Empty;
        this.sequenceIndex = 0;
        this.state = State.InTagName;
        this.stateInTagName(c);
      }
      stateCDATASequence(c) {
        if (c === Sequences.Cdata[this.sequenceIndex]) {
          if (++this.sequenceIndex === Sequences.Cdata.length) {
            this.state = State.InCommentLike;
            this.currentSequence = Sequences.CdataEnd;
            this.sequenceIndex = 0;
            this.sectionStart = this.index + 1;
          }
        } else {
          this.sequenceIndex = 0;
          if (this.xmlMode) {
            this.state = State.InDeclaration;
            this.stateInDeclaration(c);
          } else {
            this.state = State.InSpecialComment;
            this.stateInSpecialComment(c);
          }
        }
      }
      /**
       * When we wait for one specific character, we can speed things up
       * by skipping through the buffer until we find it.
       * @param c Current character code point.
       * @returns Whether the character was found.
       */
      fastForwardTo(c) {
        while (++this.index < this.buffer.length + this.offset) {
          if (this.buffer.charCodeAt(this.index - this.offset) === c) {
            return true;
          }
        }
        this.index = this.buffer.length + this.offset - 1;
        return false;
      }
      /**
       * Emit a comment token and return to the text state.
       * @param offset Number of characters in the end sequence that have already been matched.
       */
      emitComment(offset) {
        this.cbs.oncomment(this.sectionStart, this.index, offset);
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
        this.state = State.Text;
      }
      /**
       * Comments and CDATA end with `-->` and `]]>`.
       *
       * Their common qualities are:
       * - Their end sequences have a distinct character they start with.
       * - That character is then repeated, so we have to check multiple repeats.
       * - All characters but the start character of the sequence can be skipped.
       * @param c Current character code point.
       */
      stateInCommentLike(c) {
        if (!this.xmlMode && this.currentSequence === Sequences.CommentEnd && this.sequenceIndex <= 1 && /*
         * We're still at the very start of the comment: the only
         * characters consumed since `<!--` are the dashes that
         * advanced sequenceIndex (0 for `<!-->`, 1 for `<!--->`).
         */
        this.index === this.sectionStart + this.sequenceIndex && c === CharCodes2.Gt) {
          this.emitComment(this.sequenceIndex);
        } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === 2 && c === CharCodes2.Gt) {
          this.emitComment(2);
        } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === this.currentSequence.length - 1 && c !== CharCodes2.Gt) {
          this.sequenceIndex = Number(c === CharCodes2.Dash);
        } else if (c === this.currentSequence[this.sequenceIndex]) {
          if (++this.sequenceIndex === this.currentSequence.length) {
            if (this.currentSequence === Sequences.CdataEnd) {
              this.cbs.oncdata(this.sectionStart, this.index, 2);
            } else {
              this.cbs.oncomment(this.sectionStart, this.index, 3);
            }
            this.sequenceIndex = 0;
            this.sectionStart = this.index + 1;
            this.state = State.Text;
          }
        } else if (this.sequenceIndex === 0) {
          if (this.fastForwardTo(this.currentSequence[0])) {
            this.sequenceIndex = 1;
          }
        } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
          this.sequenceIndex = 0;
        }
      }
      /**
       * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
       *
       * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
       * We allow anything that wouldn't end the tag.
       * @param c Current character code point.
       */
      isTagStartChar(c) {
        return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
      }
      /**
       * Scan raw-text / RCDATA content for the matching end tag.
       *
       * For RCDATA tags (`<title>`, `<textarea>`) entities are decoded inline.
       * For raw-text tags (`<script>`, `<style>`, etc.) we fast-forward to `<`.
       * @param c Current character code point.
       */
      stateInSpecialTag(c) {
        if (this.sequenceIndex === this.currentSequence.length) {
          if (isEndOfTagSection(c)) {
            const endOfText = this.index - this.currentSequence.length;
            if (this.sectionStart < endOfText) {
              const actualIndex = this.index;
              this.index = endOfText;
              this.cbs.ontext(this.sectionStart, endOfText);
              this.index = actualIndex;
            }
            this.isSpecial = false;
            this.sectionStart = endOfText + 2;
            this.stateInClosingTagName(c);
            return;
          }
          this.sequenceIndex = 0;
        }
        if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
          this.sequenceIndex += 1;
        } else if (this.sequenceIndex === 0) {
          if (this.currentSequence === Sequences.TitleEnd || this.currentSequence === Sequences.TextareaEnd) {
            if (this.decodeEntities && c === CharCodes2.Amp) {
              this.startEntity();
            }
          } else if (this.fastForwardTo(CharCodes2.Lt)) {
            this.sequenceIndex = 1;
          }
        } else {
          this.sequenceIndex = Number(c === CharCodes2.Lt);
        }
      }
      stateBeforeTagName(c) {
        if (c === CharCodes2.ExclamationMark) {
          this.state = State.BeforeDeclaration;
          this.sectionStart = this.index + 1;
        } else if (c === CharCodes2.Questionmark) {
          if (this.xmlMode) {
            this.state = State.InProcessingInstruction;
            this.sequenceIndex = 0;
            this.sectionStart = this.index + 1;
          } else {
            this.state = State.InSpecialComment;
            this.sectionStart = this.index;
          }
        } else if (this.isTagStartChar(c)) {
          this.sectionStart = this.index;
          const special = this.xmlMode || this.cbs.isInForeignContext?.() ? void 0 : specialStartSequences.get(c | 32);
          if (special === void 0) {
            this.state = State.InTagName;
          } else {
            this.isSpecial = true;
            this.currentSequence = special;
            this.sequenceIndex = 3;
            this.state = State.SpecialStartSequence;
          }
        } else if (c === CharCodes2.Slash) {
          this.state = State.BeforeClosingTagName;
        } else {
          this.state = State.Text;
          this.stateText(c);
        }
      }
      stateInTagName(c) {
        if (isEndOfTagSection(c)) {
          this.cbs.onopentagname(this.sectionStart, this.index);
          this.sectionStart = -1;
          this.state = State.BeforeAttributeName;
          this.stateBeforeAttributeName(c);
        }
      }
      stateBeforeClosingTagName(c) {
        if (isWhitespace(c)) {
          if (this.xmlMode) {
          } else {
            this.state = State.InSpecialComment;
            this.sectionStart = this.index;
          }
        } else if (c === CharCodes2.Gt) {
          this.state = State.Text;
          if (!this.xmlMode) {
            this.sectionStart = this.index + 1;
          }
        } else {
          this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InSpecialComment;
          this.sectionStart = this.index;
        }
      }
      stateInClosingTagName(c) {
        if (isEndOfTagSection(c)) {
          this.cbs.onclosetag(this.sectionStart, this.index);
          this.sectionStart = -1;
          this.state = State.AfterClosingTagName;
          this.stateAfterClosingTagName(c);
        }
      }
      stateAfterClosingTagName(c) {
        if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
          this.state = State.Text;
          this.sectionStart = this.index + 1;
        }
      }
      stateBeforeAttributeName(c) {
        if (c === CharCodes2.Gt) {
          this.cbs.onopentagend(this.index);
          this.enterTagBody();
          this.sectionStart = this.index + 1;
        } else if (c === CharCodes2.Slash) {
          this.state = State.InSelfClosingTag;
        } else if (!isWhitespace(c)) {
          this.state = State.InAttributeName;
          this.sectionStart = this.index;
        }
      }
      /**
       * Handle `/` before `>` in an opening tag.
       *
       * In HTML mode, text-only tags ignore the self-closing flag and still enter
       * their raw-text/RCDATA/plaintext state unless self-closing tags are being
       * recognized. In XML mode, or for ordinary tags, the tokenizer returns to
       * regular text parsing after emitting the self-closing callback.
       * @param c Current character code point.
       */
      stateInSelfClosingTag(c) {
        if (c === CharCodes2.Gt) {
          this.cbs.onselfclosingtag(this.index);
          this.sectionStart = this.index + 1;
          if (!this.recognizeSelfClosing) {
            this.enterTagBody();
            return;
          }
          this.state = State.Text;
          this.isSpecial = false;
          this.currentSequence = Sequences.Empty;
        } else if (!isWhitespace(c)) {
          this.state = State.BeforeAttributeName;
          this.stateBeforeAttributeName(c);
        }
      }
      stateInAttributeName(c) {
        if (c === CharCodes2.Eq || isEndOfTagSection(c)) {
          this.cbs.onattribname(this.sectionStart, this.index);
          this.sectionStart = this.index;
          this.state = State.AfterAttributeName;
          this.stateAfterAttributeName(c);
        }
      }
      stateAfterAttributeName(c) {
        if (c === CharCodes2.Eq) {
          this.state = State.BeforeAttributeValue;
        } else if (c === CharCodes2.Slash || c === CharCodes2.Gt) {
          this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
          this.sectionStart = -1;
          this.state = State.BeforeAttributeName;
          this.stateBeforeAttributeName(c);
        } else if (!isWhitespace(c)) {
          this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
          this.state = State.InAttributeName;
          this.sectionStart = this.index;
        }
      }
      stateBeforeAttributeValue(c) {
        if (c === CharCodes2.DoubleQuote) {
          this.state = State.InAttributeValueDq;
          this.sectionStart = this.index + 1;
        } else if (c === CharCodes2.SingleQuote) {
          this.state = State.InAttributeValueSq;
          this.sectionStart = this.index + 1;
        } else if (!isWhitespace(c)) {
          this.sectionStart = this.index;
          this.state = State.InAttributeValueNq;
          this.stateInAttributeValueNoQuotes(c);
        }
      }
      handleInAttributeValue(c, quote) {
        if (c === quote || !this.decodeEntities && this.fastForwardTo(quote)) {
          this.cbs.onattribdata(this.sectionStart, this.index);
          this.sectionStart = -1;
          this.cbs.onattribend(quote === CharCodes2.DoubleQuote ? QuoteType.Double : QuoteType.Single, this.index + 1);
          this.state = State.BeforeAttributeName;
        } else if (this.decodeEntities && c === CharCodes2.Amp) {
          this.startEntity();
        }
      }
      stateInAttributeValueDoubleQuotes(c) {
        this.handleInAttributeValue(c, CharCodes2.DoubleQuote);
      }
      stateInAttributeValueSingleQuotes(c) {
        this.handleInAttributeValue(c, CharCodes2.SingleQuote);
      }
      stateInAttributeValueNoQuotes(c) {
        if (isWhitespace(c) || c === CharCodes2.Gt) {
          this.cbs.onattribdata(this.sectionStart, this.index);
          this.sectionStart = -1;
          this.cbs.onattribend(QuoteType.Unquoted, this.index);
          this.state = State.BeforeAttributeName;
          this.stateBeforeAttributeName(c);
        } else if (this.decodeEntities && c === CharCodes2.Amp) {
          this.startEntity();
        }
      }
      /**
       * Distinguish between CDATA, declarations, HTML comments, and HTML bogus
       * comments after `<!`.
       *
       * In HTML mode, only real comments and doctypes stay on declaration paths;
       * everything else becomes a bogus comment terminated by the next `>`.
       * @param c Current character code point.
       */
      stateBeforeDeclaration(c) {
        if (c === CharCodes2.OpeningSquareBracket) {
          this.state = State.CDATASequence;
          this.sequenceIndex = 0;
        } else if (this.xmlMode) {
          this.state = c === CharCodes2.Dash ? State.BeforeComment : State.InDeclaration;
        } else if ((c | 32) === Sequences.Doctype[0]) {
          this.state = State.DeclarationSequence;
          this.currentSequence = Sequences.Doctype;
          this.sequenceIndex = 1;
        } else if (c === CharCodes2.Gt) {
          this.cbs.oncomment(this.sectionStart, this.index, 0);
          this.state = State.Text;
          this.sectionStart = this.index + 1;
        } else if (c === CharCodes2.Dash) {
          this.state = State.BeforeComment;
        } else {
          this.state = State.InSpecialComment;
        }
      }
      /**
       * Continue matching `doctype` after `<!d`.
       *
       * A full `doctype` match stays on the declaration path; any other name falls
       * back to an HTML bogus comment, which matches browser behavior for
       * non-doctype `<!...>` constructs.
       * @param c Current character code point.
       */
      stateDeclarationSequence(c) {
        if (this.sequenceIndex === this.currentSequence.length) {
          this.state = State.InDeclaration;
          this.stateInDeclaration(c);
        } else if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
          this.sequenceIndex += 1;
        } else if (c === CharCodes2.Gt) {
          this.cbs.oncomment(this.sectionStart, this.index, 0);
          this.state = State.Text;
          this.sectionStart = this.index + 1;
        } else {
          this.state = State.InSpecialComment;
        }
      }
      stateInDeclaration(c) {
        if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
          this.cbs.ondeclaration(this.sectionStart, this.index);
          this.state = State.Text;
          this.sectionStart = this.index + 1;
        }
      }
      /**
       * XML processing instructions (`<?...?>`).
       *
       * In HTML mode `<?` is routed to `InSpecialComment` instead, so this
       * state is only reachable in XML mode.
       * @param c Current character code point.
       */
      stateInProcessingInstruction(c) {
        if (c === CharCodes2.Questionmark) {
          this.sequenceIndex = 1;
        } else if (c === CharCodes2.Gt && this.sequenceIndex === 1) {
          this.cbs.onprocessinginstruction(this.sectionStart, this.index - 1);
          this.sequenceIndex = 0;
          this.state = State.Text;
          this.sectionStart = this.index + 1;
        } else {
          this.sequenceIndex = Number(this.fastForwardTo(CharCodes2.Questionmark));
        }
      }
      stateBeforeComment(c) {
        if (c === CharCodes2.Dash) {
          this.state = State.InCommentLike;
          this.currentSequence = Sequences.CommentEnd;
          this.sequenceIndex = 0;
          this.sectionStart = this.index + 1;
        } else if (this.xmlMode) {
          this.state = State.InDeclaration;
        } else if (c === CharCodes2.Gt) {
          this.cbs.oncomment(this.sectionStart, this.index, 0);
          this.state = State.Text;
          this.sectionStart = this.index + 1;
        } else {
          this.state = State.InSpecialComment;
        }
      }
      stateInSpecialComment(c) {
        if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
          this.cbs.oncomment(this.sectionStart, this.index, 0);
          this.state = State.Text;
          this.sectionStart = this.index + 1;
        }
      }
      startEntity() {
        this.baseState = this.state;
        this.state = State.InEntity;
        this.entityStart = this.index;
        this.entityDecoder.startEntity(this.xmlMode ? DecodingMode.Strict : this.baseState === State.Text || this.baseState === State.InSpecialTag ? DecodingMode.Legacy : DecodingMode.Attribute);
      }
      stateInEntity() {
        const indexInBuffer = this.index - this.offset;
        const length = this.entityDecoder.write(this.buffer, indexInBuffer);
        if (length >= 0) {
          this.state = this.baseState;
          if (length === 0) {
            this.index -= 1;
          }
        } else {
          if (indexInBuffer < this.buffer.length && this.buffer.charCodeAt(indexInBuffer) === CharCodes2.Amp) {
            this.state = this.baseState;
            this.index -= 1;
            return;
          }
          this.index = this.offset + this.buffer.length - 1;
        }
      }
      /**
       * Remove data that has already been consumed from the buffer.
       */
      cleanup() {
        if (this.running && this.sectionStart !== this.index) {
          if (this.state === State.Text || this.state === State.InPlainText || this.state === State.InSpecialTag && this.sequenceIndex === 0) {
            this.cbs.ontext(this.sectionStart, this.index);
            this.sectionStart = this.index;
          } else if (this.state === State.InAttributeValueDq || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueNq) {
            this.cbs.onattribdata(this.sectionStart, this.index);
            this.sectionStart = this.index;
          }
        }
      }
      shouldContinue() {
        return this.index < this.buffer.length + this.offset && this.running;
      }
      /**
       * Iterates through the buffer, calling the function corresponding to the current state.
       *
       * States that are more likely to be hit are higher up, as a performance improvement.
       */
      parse() {
        while (this.shouldContinue()) {
          const c = this.buffer.charCodeAt(this.index - this.offset);
          switch (this.state) {
            case State.Text: {
              this.stateText(c);
              break;
            }
            case State.InPlainText: {
              this.index = this.buffer.length + this.offset - 1;
              break;
            }
            case State.SpecialStartSequence: {
              this.stateSpecialStartSequence(c);
              break;
            }
            case State.InSpecialTag: {
              this.stateInSpecialTag(c);
              break;
            }
            case State.CDATASequence: {
              this.stateCDATASequence(c);
              break;
            }
            case State.DeclarationSequence: {
              this.stateDeclarationSequence(c);
              break;
            }
            case State.InAttributeValueDq: {
              this.stateInAttributeValueDoubleQuotes(c);
              break;
            }
            case State.InAttributeName: {
              this.stateInAttributeName(c);
              break;
            }
            case State.InCommentLike: {
              this.stateInCommentLike(c);
              break;
            }
            case State.InSpecialComment: {
              this.stateInSpecialComment(c);
              break;
            }
            case State.BeforeAttributeName: {
              this.stateBeforeAttributeName(c);
              break;
            }
            case State.InTagName: {
              this.stateInTagName(c);
              break;
            }
            case State.InClosingTagName: {
              this.stateInClosingTagName(c);
              break;
            }
            case State.BeforeTagName: {
              this.stateBeforeTagName(c);
              break;
            }
            case State.AfterAttributeName: {
              this.stateAfterAttributeName(c);
              break;
            }
            case State.InAttributeValueSq: {
              this.stateInAttributeValueSingleQuotes(c);
              break;
            }
            case State.BeforeAttributeValue: {
              this.stateBeforeAttributeValue(c);
              break;
            }
            case State.BeforeClosingTagName: {
              this.stateBeforeClosingTagName(c);
              break;
            }
            case State.AfterClosingTagName: {
              this.stateAfterClosingTagName(c);
              break;
            }
            case State.InAttributeValueNq: {
              this.stateInAttributeValueNoQuotes(c);
              break;
            }
            case State.InSelfClosingTag: {
              this.stateInSelfClosingTag(c);
              break;
            }
            case State.InDeclaration: {
              this.stateInDeclaration(c);
              break;
            }
            case State.BeforeDeclaration: {
              this.stateBeforeDeclaration(c);
              break;
            }
            case State.BeforeComment: {
              this.stateBeforeComment(c);
              break;
            }
            case State.InProcessingInstruction: {
              this.stateInProcessingInstruction(c);
              break;
            }
            case State.InEntity: {
              this.stateInEntity();
              break;
            }
          }
          this.index++;
        }
        this.cleanup();
      }
      finish() {
        if (this.state === State.InEntity) {
          this.entityDecoder.end();
          this.state = this.baseState;
        }
        this.handleTrailingData();
        this.cbs.onend();
      }
      handleTrailingCommentLikeData(endIndex) {
        if (this.state !== State.InCommentLike) {
          return false;
        }
        if (this.currentSequence === Sequences.CdataEnd) {
          if (this.xmlMode) {
            if (this.sectionStart < endIndex) {
              this.cbs.oncdata(this.sectionStart, endIndex, 0);
            }
          } else {
            const cdataStart = this.sectionStart - Sequences.Cdata.length - 1;
            this.cbs.oncomment(cdataStart, endIndex, 0);
          }
        } else {
          const offset = this.xmlMode ? 0 : Math.min(this.sequenceIndex, Sequences.CommentEnd.length - 1);
          this.cbs.oncomment(this.sectionStart, endIndex, offset);
        }
        return true;
      }
      handleTrailingMarkupDeclaration(endIndex) {
        if (this.xmlMode) {
          switch (this.state) {
            case State.InSpecialComment:
            case State.BeforeComment:
            case State.CDATASequence:
            case State.DeclarationSequence:
            case State.InDeclaration: {
              this.cbs.ontext(this.sectionStart, endIndex);
              return true;
            }
            default: {
              return false;
            }
          }
        }
        switch (this.state) {
          case State.BeforeDeclaration:
          case State.InSpecialComment:
          case State.BeforeComment:
          case State.CDATASequence: {
            this.cbs.oncomment(this.sectionStart, endIndex, 0);
            return true;
          }
          case State.DeclarationSequence: {
            if (this.sequenceIndex !== Sequences.Doctype.length) {
              this.cbs.oncomment(this.sectionStart, endIndex, 0);
            }
            return true;
          }
          case State.InDeclaration: {
            return true;
          }
          default: {
            return false;
          }
        }
      }
      /** Handle any trailing data. */
      handleTrailingData() {
        const endIndex = this.buffer.length + this.offset;
        if (this.handleTrailingCommentLikeData(endIndex) || this.handleTrailingMarkupDeclaration(endIndex)) {
          return;
        }
        if (this.sectionStart >= endIndex) {
          return;
        }
        switch (this.state) {
          case State.InTagName:
          case State.BeforeAttributeName:
          case State.BeforeAttributeValue:
          case State.AfterAttributeName:
          case State.InAttributeName:
          case State.InAttributeValueSq:
          case State.InAttributeValueDq:
          case State.InAttributeValueNq:
          case State.InClosingTagName: {
            break;
          }
          default: {
            this.cbs.ontext(this.sectionStart, endIndex);
          }
        }
      }
      emitCodePoint(cp, consumed) {
        if (this.baseState !== State.Text && this.baseState !== State.InSpecialTag) {
          if (this.sectionStart < this.entityStart) {
            this.cbs.onattribdata(this.sectionStart, this.entityStart);
          }
          this.sectionStart = this.entityStart + consumed;
          this.index = this.sectionStart - 1;
          this.cbs.onattribentity(cp);
        } else {
          if (this.sectionStart < this.entityStart) {
            this.cbs.ontext(this.sectionStart, this.entityStart);
          }
          this.sectionStart = this.entityStart + consumed;
          this.index = this.sectionStart - 1;
          this.cbs.ontextentity(cp, this.sectionStart);
        }
      }
    };
  }
});

// node_modules/htmlparser2/dist/Parser.js
var fromCodePoint2, formTags, pTag, headingTags, tableSectionTags, ddtTags, rtpTags, openImpliesClose, DOCUMENT_TYPE, voidElements, foreignContextElements, htmlIntegrationElements, svgTagNameAdjustments, ForeignContext, reNameEnd, Parser2;
var init_Parser = __esm({
  "node_modules/htmlparser2/dist/Parser.js"() {
    init_Tokenizer();
    ({ fromCodePoint: fromCodePoint2 } = String);
    formTags = /* @__PURE__ */ new Set([
      "input",
      "option",
      "optgroup",
      "select",
      "button",
      "datalist",
      "textarea"
    ]);
    pTag = /* @__PURE__ */ new Set(["p"]);
    headingTags = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);
    tableSectionTags = /* @__PURE__ */ new Set(["thead", "tbody"]);
    ddtTags = /* @__PURE__ */ new Set(["dd", "dt"]);
    rtpTags = /* @__PURE__ */ new Set(["rt", "rp"]);
    openImpliesClose = /* @__PURE__ */ new Map([
      ["tr", /* @__PURE__ */ new Set(["tr", "th", "td"])],
      ["th", /* @__PURE__ */ new Set(["th"])],
      ["td", /* @__PURE__ */ new Set(["thead", "th", "td"])],
      ["body", /* @__PURE__ */ new Set(["head", "link", "script"])],
      ["a", /* @__PURE__ */ new Set(["a"])],
      ["li", /* @__PURE__ */ new Set(["li"])],
      ["p", pTag],
      ["h1", headingTags],
      ["h2", headingTags],
      ["h3", headingTags],
      ["h4", headingTags],
      ["h5", headingTags],
      ["h6", headingTags],
      ["select", formTags],
      ["input", formTags],
      ["output", formTags],
      ["button", formTags],
      ["datalist", formTags],
      ["textarea", formTags],
      ["option", /* @__PURE__ */ new Set(["option"])],
      ["optgroup", /* @__PURE__ */ new Set(["optgroup", "option"])],
      ["dd", ddtTags],
      ["dt", ddtTags],
      ["address", pTag],
      ["article", pTag],
      ["aside", pTag],
      ["blockquote", pTag],
      ["details", pTag],
      ["div", pTag],
      ["dl", pTag],
      ["fieldset", pTag],
      ["figcaption", pTag],
      ["figure", pTag],
      ["footer", pTag],
      ["form", pTag],
      ["header", pTag],
      ["hr", pTag],
      ["main", pTag],
      ["nav", pTag],
      ["ol", pTag],
      ["pre", pTag],
      ["section", pTag],
      ["table", pTag],
      ["ul", pTag],
      ["rt", rtpTags],
      ["rp", rtpTags],
      ["tbody", tableSectionTags],
      ["tfoot", tableSectionTags]
    ]);
    DOCUMENT_TYPE = "doctype";
    voidElements = /* @__PURE__ */ new Set([
      "area",
      "base",
      "basefont",
      "br",
      "col",
      "command",
      "embed",
      "frame",
      "hr",
      "img",
      "input",
      "isindex",
      "keygen",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr"
    ]);
    foreignContextElements = /* @__PURE__ */ new Set(["math", "svg"]);
    htmlIntegrationElements = /* @__PURE__ */ new Set([
      "mi",
      "mo",
      "mn",
      "ms",
      "mtext",
      "annotation-xml",
      "foreignObject",
      "desc",
      "title"
    ]);
    svgTagNameAdjustments = /* @__PURE__ */ new Map([
      ["altglyph", "altGlyph"],
      ["altglyphdef", "altGlyphDef"],
      ["altglyphitem", "altGlyphItem"],
      ["animatecolor", "animateColor"],
      ["animatemotion", "animateMotion"],
      ["animatetransform", "animateTransform"],
      ["clippath", "clipPath"],
      ["feblend", "feBlend"],
      ["fecolormatrix", "feColorMatrix"],
      ["fecomponenttransfer", "feComponentTransfer"],
      ["fecomposite", "feComposite"],
      ["feconvolvematrix", "feConvolveMatrix"],
      ["fediffuselighting", "feDiffuseLighting"],
      ["fedisplacementmap", "feDisplacementMap"],
      ["fedistantlight", "feDistantLight"],
      ["fedropshadow", "feDropShadow"],
      ["feflood", "feFlood"],
      ["fefunca", "feFuncA"],
      ["fefuncb", "feFuncB"],
      ["fefuncg", "feFuncG"],
      ["fefuncr", "feFuncR"],
      ["fegaussianblur", "feGaussianBlur"],
      ["feimage", "feImage"],
      ["femerge", "feMerge"],
      ["femergenode", "feMergeNode"],
      ["femorphology", "feMorphology"],
      ["feoffset", "feOffset"],
      ["fepointlight", "fePointLight"],
      ["fespecularlighting", "feSpecularLighting"],
      ["fespotlight", "feSpotLight"],
      ["fetile", "feTile"],
      ["feturbulence", "feTurbulence"],
      ["foreignobject", "foreignObject"],
      ["glyphref", "glyphRef"],
      ["lineargradient", "linearGradient"],
      ["radialgradient", "radialGradient"],
      ["textpath", "textPath"]
    ]);
    (function(ForeignContext2) {
      ForeignContext2[ForeignContext2["None"] = 0] = "None";
      ForeignContext2[ForeignContext2["Svg"] = 1] = "Svg";
      ForeignContext2[ForeignContext2["MathML"] = 2] = "MathML";
    })(ForeignContext || (ForeignContext = {}));
    reNameEnd = /\s|\//;
    Parser2 = class {
      options;
      /** The start index of the last event. */
      startIndex = 0;
      /** The end index of the last event. */
      endIndex = 0;
      /**
       * Store the start index of the current open tag,
       * so we can update the start index for attributes.
       */
      openTagStart = 0;
      tagname = "";
      attribname = "";
      attribvalue = "";
      attribs = null;
      stack = [];
      foreignContext;
      cbs;
      lowerCaseTagNames;
      lowerCaseAttributeNames;
      recognizeSelfClosing;
      /** We are parsing HTML. Inverse of the `xmlMode` option. */
      htmlMode;
      tokenizer;
      buffers = [];
      bufferOffset = 0;
      /** The index of the last written buffer. Used when resuming after a `pause()`. */
      writeIndex = 0;
      /** Indicates whether the parser has finished running / `.end` has been called. */
      ended = false;
      constructor(cbs, options = {}) {
        this.options = options;
        this.cbs = cbs ?? {};
        this.htmlMode = !this.options.xmlMode;
        this.lowerCaseTagNames = options.lowerCaseTags ?? this.htmlMode;
        this.lowerCaseAttributeNames = options.lowerCaseAttributeNames ?? this.htmlMode;
        this.recognizeSelfClosing = options.recognizeSelfClosing ?? !this.htmlMode;
        this.tokenizer = new (options.Tokenizer ?? Tokenizer)(this.options, this);
        this.foreignContext = [ForeignContext.None];
        this.cbs.onparserinit?.(this);
      }
      // Tokenizer event handlers
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      ontext(start, endIndex) {
        const data = this.getSlice(start, endIndex);
        this.endIndex = endIndex - 1;
        this.cbs.ontext?.(data);
        this.startIndex = endIndex;
      }
      /**
       * @param cp Current Unicode code point.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      ontextentity(cp, endIndex) {
        this.endIndex = endIndex - 1;
        this.cbs.ontext?.(fromCodePoint2(cp));
        this.startIndex = endIndex;
      }
      /** @internal */
      isInForeignContext() {
        return this.foreignContext[0] !== ForeignContext.None;
      }
      /**
       * Checks if the current tag is a void element. Override this if you want
       * to specify your own additional void elements.
       * @param name Name of the pseudo selector.
       */
      isVoidElement(name) {
        return this.htmlMode && voidElements.has(name);
      }
      /**
       * Read a tag name from the buffer.
       *
       * When `lowerCaseTagNames` is enabled (the default in HTML mode), the name
       * is lowercased and may be adjusted for SVG casing or the `image` → `img`
       * alias.
       * @param start Start index of the tag name in the buffer.
       * @param endIndex End index of the tag name in the buffer.
       */
      readTagName(start, endIndex) {
        const name = this.lowerCaseTagNames ? this.getSlice(start, endIndex).toLowerCase() : this.getSlice(start, endIndex);
        if (!(this.lowerCaseTagNames && this.htmlMode)) {
          return name;
        }
        if (this.foreignContext[0] === ForeignContext.Svg) {
          return svgTagNameAdjustments.get(name) ?? name;
        }
        if (this.foreignContext.length > 1) {
          const adjusted = svgTagNameAdjustments.get(name);
          if (adjusted !== void 0 && this.stack.includes(adjusted)) {
            return adjusted;
          }
        }
        if (!this.isInForeignContext()) {
          return name === "image" ? "img" : name;
        }
        return name;
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onopentagname(start, endIndex) {
        this.endIndex = endIndex;
        this.emitOpenTag(this.readTagName(start, endIndex));
      }
      emitOpenTag(name) {
        this.openTagStart = this.startIndex;
        this.tagname = name;
        if (this.htmlMode && name === "form" && this.stack.includes("form")) {
          this.tagname = "";
          return;
        }
        const impliesClose = this.htmlMode && openImpliesClose.get(name);
        if (impliesClose) {
          while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
            this.popElement(true);
          }
        }
        if (!this.isVoidElement(name)) {
          this.stack.unshift(name);
          if (this.htmlMode) {
            if (name === "svg") {
              this.foreignContext.unshift(ForeignContext.Svg);
            } else if (name === "math") {
              this.foreignContext.unshift(ForeignContext.MathML);
            } else if (htmlIntegrationElements.has(name)) {
              this.foreignContext.unshift(ForeignContext.None);
            }
          }
        }
        this.cbs.onopentagname?.(name);
        if (this.cbs.onopentag)
          this.attribs = {};
      }
      endOpenTag(isImplied) {
        this.startIndex = this.openTagStart;
        if (this.attribs) {
          this.cbs.onopentag?.(this.tagname, this.attribs, isImplied);
          this.attribs = null;
        }
        if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
          this.cbs.onclosetag(this.tagname, true);
        }
        this.tagname = "";
      }
      /**
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onopentagend(endIndex) {
        this.endIndex = endIndex;
        this.endOpenTag(false);
        this.startIndex = endIndex + 1;
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onclosetag(start, endIndex) {
        this.endIndex = endIndex;
        const name = this.readTagName(start, endIndex);
        if (!this.isVoidElement(name)) {
          const pos = this.stack.indexOf(name);
          if (pos !== -1) {
            for (let index = 0; index < pos; index++) {
              this.popElement(true);
            }
            this.popElement(false);
          } else if (this.htmlMode && name === "p") {
            this.emitOpenTag("p");
            this.closeCurrentTag(true);
          }
        } else if (this.htmlMode && name === "br") {
          this.cbs.onopentagname?.("br");
          this.cbs.onopentag?.("br", {}, true);
          this.cbs.onclosetag?.("br", false);
        }
        this.startIndex = endIndex + 1;
      }
      /**
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onselfclosingtag(endIndex) {
        this.endIndex = endIndex;
        if (this.recognizeSelfClosing || this.isInForeignContext()) {
          this.closeCurrentTag(false);
          this.startIndex = endIndex + 1;
        } else {
          this.onopentagend(endIndex);
        }
      }
      /**
       * Pop the top element off the stack, emit a close event, and maintain
       * the foreign context stack.
       * @param implied Whether this close is implied (not from an explicit end tag).
       */
      popElement(implied) {
        const element = this.stack.shift();
        if (this.htmlMode && (foreignContextElements.has(element) || htmlIntegrationElements.has(element))) {
          this.foreignContext.shift();
        }
        this.cbs.onclosetag?.(element, implied);
      }
      closeCurrentTag(isOpenImplied) {
        const name = this.tagname;
        this.endOpenTag(isOpenImplied);
        if (this.stack[0] === name) {
          this.popElement(!isOpenImplied);
        }
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onattribname(start, endIndex) {
        this.startIndex = start;
        const name = this.getSlice(start, endIndex);
        this.attribname = this.lowerCaseAttributeNames ? name.toLowerCase() : name;
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onattribdata(start, endIndex) {
        this.attribvalue += this.getSlice(start, endIndex);
      }
      /**
       * @param cp Current Unicode code point.
       * @internal
       */
      onattribentity(cp) {
        this.attribvalue += fromCodePoint2(cp);
      }
      /**
       * @param quote Quote type used for the current attribute.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onattribend(quote, endIndex) {
        this.endIndex = endIndex;
        this.cbs.onattribute?.(this.attribname, this.attribvalue, quote === QuoteType.Double ? '"' : quote === QuoteType.Single ? "'" : quote === QuoteType.NoValue ? void 0 : null);
        if (this.attribs && !Object.hasOwn(this.attribs, this.attribname)) {
          this.attribs[this.attribname] = this.attribvalue;
        }
        this.attribvalue = "";
      }
      getInstructionName(value) {
        const index = value.search(reNameEnd);
        let name = index < 0 ? value : value.substr(0, index);
        if (this.lowerCaseTagNames) {
          name = name.toLowerCase();
        }
        return name;
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      ondeclaration(start, endIndex) {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);
        if (this.cbs.onprocessinginstruction) {
          const name = this.htmlMode ? this.lowerCaseTagNames ? DOCUMENT_TYPE : value.slice(0, DOCUMENT_TYPE.length) : this.getInstructionName(value);
          this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
        }
        this.startIndex = endIndex + 1;
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @internal
       */
      onprocessinginstruction(start, endIndex) {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);
        if (this.cbs.onprocessinginstruction) {
          const name = this.getInstructionName(value);
          this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
        }
        this.startIndex = endIndex + 1;
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @param offset Offset applied when computing parser indices.
       * @internal
       */
      oncomment(start, endIndex, offset) {
        this.endIndex = endIndex;
        this.cbs.oncomment?.(this.getSlice(start, endIndex - offset));
        this.cbs.oncommentend?.();
        this.startIndex = endIndex + 1;
      }
      /**
       * @param start Start index for the current parser event.
       * @param endIndex End index for the current parser event.
       * @param offset Offset applied when computing parser indices.
       * @internal
       */
      oncdata(start, endIndex, offset) {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex - offset);
        if (!this.htmlMode || this.options.recognizeCDATA) {
          this.cbs.oncdatastart?.();
          this.cbs.ontext?.(value);
          this.cbs.oncdataend?.();
        } else if (this.isInForeignContext()) {
          this.cbs.ontext?.(value);
        } else {
          this.cbs.oncomment?.(`[CDATA[${value}]]`);
          this.cbs.oncommentend?.();
        }
        this.startIndex = endIndex + 1;
      }
      /** @internal */
      onend() {
        if (this.cbs.onclosetag) {
          this.endIndex = this.startIndex;
          for (let index = 0; index < this.stack.length; index++) {
            this.cbs.onclosetag(this.stack[index], true);
          }
        }
        this.cbs.onend?.();
      }
      /**
       * Resets the parser to a blank state, ready to parse a new HTML document
       */
      reset() {
        this.cbs.onreset?.();
        this.tokenizer.reset();
        this.tagname = "";
        this.attribname = "";
        this.attribvalue = "";
        this.attribs = null;
        this.stack.length = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.cbs.onparserinit?.(this);
        this.buffers.length = 0;
        this.foreignContext.length = 0;
        this.foreignContext.unshift(ForeignContext.None);
        this.bufferOffset = 0;
        this.writeIndex = 0;
        this.ended = false;
      }
      /**
       * Resets the parser, then parses a complete document and
       * pushes it to the handler.
       * @param data Document to parse.
       */
      parseComplete(data) {
        this.reset();
        this.end(data);
      }
      getSlice(start, end) {
        if (start === end) {
          return "";
        }
        while (start - this.bufferOffset >= this.buffers[0].length) {
          this.shiftBuffer();
        }
        let slice = this.buffers[0].slice(start - this.bufferOffset, end - this.bufferOffset);
        while (end - this.bufferOffset > this.buffers[0].length) {
          this.shiftBuffer();
          slice += this.buffers[0].slice(0, end - this.bufferOffset);
        }
        return slice;
      }
      shiftBuffer() {
        this.bufferOffset += this.buffers[0].length;
        this.writeIndex--;
        this.buffers.shift();
      }
      /**
       * Parses a chunk of data and calls the corresponding callbacks.
       * @param chunk Chunk to parse.
       */
      write(chunk) {
        if (this.ended) {
          this.cbs.onerror?.(new Error(".write() after done!"));
          return;
        }
        this.buffers.push(chunk);
        if (this.tokenizer.running) {
          this.tokenizer.write(chunk);
          this.writeIndex++;
        }
      }
      /**
       * Parses the end of the buffer and clears the stack, calls onend.
       * @param chunk Optional final chunk to parse.
       */
      end(chunk) {
        if (this.ended) {
          this.cbs.onerror?.(new Error(".end() after done!"));
          return;
        }
        if (chunk)
          this.write(chunk);
        this.ended = true;
        this.tokenizer.end();
      }
      /**
       * Pauses parsing. The parser won't emit events until `resume` is called.
       */
      pause() {
        this.tokenizer.pause();
      }
      /**
       * Resumes parsing after `pause` was called.
       */
      resume() {
        this.tokenizer.resume();
        while (this.tokenizer.running && this.writeIndex < this.buffers.length) {
          this.tokenizer.write(this.buffers[this.writeIndex++]);
        }
        if (this.ended)
          this.tokenizer.end();
      }
    };
  }
});

// node_modules/domelementtype/dist/index.js
var dist_exports2 = {};
__export(dist_exports2, {
  CDATA: () => CDATA,
  Comment: () => Comment,
  Directive: () => Directive,
  Doctype: () => Doctype,
  ElementType: () => ElementType,
  Root: () => Root,
  Script: () => Script,
  Style: () => Style,
  Tag: () => Tag,
  Text: () => Text,
  isTag: () => isTag
});
function isTag(element) {
  return element.type === ElementType.Tag || element.type === ElementType.Script || element.type === ElementType.Style;
}
var ElementType, Root, Text, Directive, Comment, Script, Style, Tag, CDATA, Doctype;
var init_dist2 = __esm({
  "node_modules/domelementtype/dist/index.js"() {
    (function(ElementType2) {
      ElementType2["Root"] = "root";
      ElementType2["Text"] = "text";
      ElementType2["Directive"] = "directive";
      ElementType2["Comment"] = "comment";
      ElementType2["Script"] = "script";
      ElementType2["Style"] = "style";
      ElementType2["Tag"] = "tag";
      ElementType2["CDATA"] = "cdata";
      ElementType2["Doctype"] = "doctype";
    })(ElementType || (ElementType = {}));
    Root = ElementType.Root;
    Text = ElementType.Text;
    Directive = ElementType.Directive;
    Comment = ElementType.Comment;
    Script = ElementType.Script;
    Style = ElementType.Style;
    Tag = ElementType.Tag;
    CDATA = ElementType.CDATA;
    Doctype = ElementType.Doctype;
  }
});

// node_modules/domhandler/dist/node.js
function isTag2(node) {
  return isTag(node);
}
function isCDATA(node) {
  return node.type === ElementType.CDATA;
}
function isText(node) {
  return node.type === ElementType.Text;
}
function isComment(node) {
  return node.type === ElementType.Comment;
}
function isDirective(node) {
  return node.type === ElementType.Directive;
}
function isDocument2(node) {
  return node.type === ElementType.Root;
}
function hasChildren(node) {
  return Object.hasOwn(node, "children");
}
function cloneNode(node, recursive = false) {
  let result;
  if (isText(node)) {
    result = new Text2(node.data);
  } else if (isComment(node)) {
    result = new Comment2(node.data);
  } else if (isTag2(node)) {
    const children = recursive ? cloneChildren(node.children) : [];
    const clone = new Element(node.name, { ...node.attribs }, children);
    for (const child of children) {
      child.parent = clone;
    }
    if (node.namespace != null) {
      clone.namespace = node.namespace;
    }
    if (node["x-attribsNamespace"]) {
      clone["x-attribsNamespace"] = { ...node["x-attribsNamespace"] };
    }
    if (node["x-attribsPrefix"]) {
      clone["x-attribsPrefix"] = { ...node["x-attribsPrefix"] };
    }
    result = clone;
  } else if (isCDATA(node)) {
    const children = recursive ? cloneChildren(node.children) : [];
    const clone = new CDATA2(children);
    for (const child of children) {
      child.parent = clone;
    }
    result = clone;
  } else if (isDocument2(node)) {
    const children = recursive ? cloneChildren(node.children) : [];
    const clone = new Document2(children);
    for (const child of children) {
      child.parent = clone;
    }
    if (node["x-mode"]) {
      clone["x-mode"] = node["x-mode"];
    }
    result = clone;
  } else if (isDirective(node)) {
    const instruction = new ProcessingInstruction(node.name, node.data);
    if (node["x-name"] != null) {
      instruction["x-name"] = node["x-name"];
      instruction["x-publicId"] = node["x-publicId"];
      instruction["x-systemId"] = node["x-systemId"];
    }
    result = instruction;
  } else {
    throw new Error(`Not implemented yet: ${node.type}`);
  }
  result.startIndex = node.startIndex;
  result.endIndex = node.endIndex;
  if (node.sourceCodeLocation != null) {
    result.sourceCodeLocation = node.sourceCodeLocation;
  }
  return result;
}
function cloneChildren(childs) {
  const children = childs.map((child) => cloneNode(child, true));
  for (let index = 1; index < children.length; index++) {
    children[index].prev = children[index - 1];
    children[index - 1].next = children[index];
  }
  return children;
}
var Node, DataNode, Text2, Comment2, ProcessingInstruction, NodeWithChildren, CDATA2, Document2, Element;
var init_node = __esm({
  "node_modules/domhandler/dist/node.js"() {
    init_dist2();
    Node = class {
      /** Parent of the node */
      parent = null;
      /** Previous sibling */
      prev = null;
      /** Next sibling */
      next = null;
      /** The start index of the node. Requires `withStartIndices` on the handler to be `true. */
      startIndex = null;
      /** The end index of the node. Requires `withEndIndices` on the handler to be `true. */
      endIndex = null;
      // Read-write aliases for properties
      /**
       * Same as {@link parent}.
       * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
       */
      get parentNode() {
        return this.parent;
      }
      set parentNode(parent) {
        this.parent = parent;
      }
      /**
       * Same as {@link prev}.
       * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
       */
      get previousSibling() {
        return this.prev;
      }
      set previousSibling(previous) {
        this.prev = previous;
      }
      /**
       * Same as {@link next}.
       * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
       */
      get nextSibling() {
        return this.next;
      }
      set nextSibling(next) {
        this.next = next;
      }
      /**
       * Clone this node, and optionally its children.
       * @param recursive Clone child nodes as well.
       * @returns A clone of the node.
       */
      cloneNode(recursive = false) {
        return cloneNode(this, recursive);
      }
    };
    DataNode = class extends Node {
      data;
      /**
       * @param data The content of the data node
       */
      constructor(data) {
        super();
        this.data = data;
      }
      /**
       * Same as {@link data}.
       * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
       */
      get nodeValue() {
        return this.data;
      }
      set nodeValue(data) {
        this.data = data;
      }
    };
    Text2 = class extends DataNode {
      type = ElementType.Text;
      get nodeType() {
        return 3;
      }
    };
    Comment2 = class extends DataNode {
      type = ElementType.Comment;
      get nodeType() {
        return 8;
      }
    };
    ProcessingInstruction = class extends DataNode {
      type = ElementType.Directive;
      name;
      constructor(name, data) {
        super(data);
        this.name = name;
      }
      get nodeType() {
        return 1;
      }
      /** If this is a doctype, the document type name (parse5 only). */
      "x-name";
      /** If this is a doctype, the document type public identifier (parse5 only). */
      "x-publicId";
      /** If this is a doctype, the document type system identifier (parse5 only). */
      "x-systemId";
    };
    NodeWithChildren = class extends Node {
      children;
      /**
       * @param children Children of the node. Only certain node types can have children.
       */
      constructor(children) {
        super();
        this.children = children;
      }
      // Aliases
      /** First child of the node. */
      get firstChild() {
        return this.children[0] ?? null;
      }
      /** Last child of the node. */
      get lastChild() {
        return this.children.length > 0 ? this.children[this.children.length - 1] : null;
      }
      /**
       * Same as {@link children}.
       * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
       */
      get childNodes() {
        return this.children;
      }
      set childNodes(children) {
        this.children = children;
      }
    };
    CDATA2 = class extends NodeWithChildren {
      type = ElementType.CDATA;
      get nodeType() {
        return 4;
      }
    };
    Document2 = class extends NodeWithChildren {
      type = ElementType.Root;
      get nodeType() {
        return 9;
      }
    };
    Element = class extends NodeWithChildren {
      name;
      attribs;
      type;
      /**
       * @param name Name of the tag, eg. `div`, `span`.
       * @param attribs Object mapping attribute names to attribute values.
       * @param children Children of the node.
       * @param type Node type used for the new node instance.
       */
      constructor(name, attribs, children = [], type = name === "script" ? ElementType.Script : name === "style" ? ElementType.Style : ElementType.Tag) {
        super(children);
        this.name = name;
        this.attribs = attribs;
        this.type = type;
      }
      get nodeType() {
        return 1;
      }
      // DOM Level 1 aliases
      /**
       * Same as {@link name}.
       * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
       */
      get tagName() {
        return this.name;
      }
      set tagName(name) {
        this.name = name;
      }
      get attributes() {
        return Object.keys(this.attribs).map((name) => ({
          name,
          value: this.attribs[name],
          namespace: this["x-attribsNamespace"]?.[name],
          prefix: this["x-attribsPrefix"]?.[name]
        }));
      }
      /** Element namespace (parse5 only). */
      namespace;
      /** Element attribute namespaces (parse5 only). */
      "x-attribsNamespace";
      /** Element attribute namespace-related prefixes (parse5 only). */
      "x-attribsPrefix";
    };
  }
});

// node_modules/domhandler/dist/index.js
var defaultOptions2, DomHandler;
var init_dist3 = __esm({
  "node_modules/domhandler/dist/index.js"() {
    init_dist2();
    init_node();
    init_node();
    defaultOptions2 = {
      withStartIndices: false,
      withEndIndices: false,
      xmlMode: false
    };
    DomHandler = class {
      /** The elements of the DOM */
      dom = [];
      /** The root element for the DOM */
      root = new Document2(this.dom);
      /** Called once parsing has completed. */
      callback;
      /** Settings for the handler. */
      options;
      /** Callback whenever a tag is closed. */
      elementCB;
      /** Indicated whether parsing has been completed. */
      done = false;
      /** Stack of open tags. */
      tagStack = [this.root];
      /** A data node that is still being written to. */
      lastNode = null;
      /** Reference to the parser instance. Used for location information. */
      parser = null;
      /**
       * @param callback Called once parsing has completed.
       * @param options Settings for the handler.
       * @param elementCB Callback whenever a tag is closed.
       */
      constructor(callback, options, elementCB) {
        if (typeof options === "function") {
          elementCB = options;
          options = defaultOptions2;
        }
        if (typeof callback === "object") {
          options = callback;
          callback = void 0;
        }
        this.callback = callback ?? null;
        this.options = options ?? defaultOptions2;
        this.elementCB = elementCB ?? null;
      }
      onparserinit(parser2) {
        this.parser = parser2;
      }
      // Resets the handler back to starting state
      onreset() {
        this.dom = [];
        this.root = new Document2(this.dom);
        this.done = false;
        this.tagStack = [this.root];
        this.lastNode = null;
        this.parser = null;
      }
      // Signals the handler that parsing is done
      onend() {
        if (this.done)
          return;
        this.done = true;
        this.parser = null;
        this.handleCallback(null);
      }
      onerror(error2) {
        this.handleCallback(error2);
      }
      onclosetag() {
        this.lastNode = null;
        const element = this.tagStack.pop();
        if (this.options.withEndIndices && this.parser) {
          element.endIndex = this.parser.endIndex;
        }
        if (this.elementCB)
          this.elementCB(element);
      }
      onopentag(name, attribs) {
        const type = this.options.xmlMode ? ElementType.Tag : void 0;
        const element = new Element(name, attribs, void 0, type);
        this.addNode(element);
        this.tagStack.push(element);
      }
      ontext(data) {
        const { lastNode } = this;
        if (lastNode && lastNode.type === ElementType.Text) {
          lastNode.data += data;
          if (this.options.withEndIndices && this.parser) {
            lastNode.endIndex = this.parser.endIndex;
          }
        } else {
          const node = new Text2(data);
          this.addNode(node);
          this.lastNode = node;
        }
      }
      oncomment(data) {
        if (this.lastNode && this.lastNode.type === ElementType.Comment) {
          this.lastNode.data += data;
          return;
        }
        const node = new Comment2(data);
        this.addNode(node);
        this.lastNode = node;
      }
      oncommentend() {
        this.lastNode = null;
      }
      oncdatastart() {
        const text2 = new Text2("");
        const node = new CDATA2([text2]);
        this.addNode(node);
        text2.parent = node;
        this.lastNode = text2;
      }
      oncdataend() {
        this.lastNode = null;
      }
      onprocessinginstruction(name, data) {
        const node = new ProcessingInstruction(name, data);
        this.addNode(node);
      }
      handleCallback(error2) {
        if (typeof this.callback === "function") {
          this.callback(error2, this.dom);
        } else if (error2) {
          throw error2;
        }
      }
      addNode(node) {
        const parent = this.tagStack[this.tagStack.length - 1];
        const previousSibling = parent.children[parent.children.length - 1];
        if (this.options.withStartIndices && this.parser) {
          node.startIndex = this.parser.startIndex;
        }
        if (this.options.withEndIndices && this.parser) {
          node.endIndex = this.parser.endIndex;
        }
        parent.children.push(node);
        if (previousSibling) {
          node.prev = previousSibling;
          previousSibling.next = node;
        }
        node.parent = parent;
        this.lastNode = null;
      }
    };
  }
});

// node_modules/domutils/dist/querying.js
function filter(test, node, recurse = true, limit = Number.POSITIVE_INFINITY) {
  return find(test, Array.isArray(node) ? node : [node], recurse, limit);
}
function find(test, nodes, recurse, limit) {
  const result = [];
  const nodeStack = [Array.isArray(nodes) ? nodes : [nodes]];
  const indexStack = [0];
  for (; ; ) {
    if (indexStack[0] >= nodeStack[0].length) {
      if (indexStack.length === 1) {
        return result;
      }
      nodeStack.shift();
      indexStack.shift();
      continue;
    }
    const element = nodeStack[0][indexStack[0]++];
    if (test(element)) {
      result.push(element);
      if (--limit <= 0)
        return result;
    }
    if (recurse && hasChildren(element) && element.children.length > 0) {
      indexStack.unshift(0);
      nodeStack.unshift(element.children);
    }
  }
}
function findOne(test, nodes, recurse = true) {
  const searchedNodes = Array.isArray(nodes) ? nodes : [nodes];
  for (const node of searchedNodes) {
    if (isTag2(node) && test(node)) {
      return node;
    }
    if (recurse && hasChildren(node) && node.children.length > 0) {
      const found = findOne(test, node.children, true);
      if (found)
        return found;
    }
  }
  return null;
}
function existsOne(test, nodes) {
  return (Array.isArray(nodes) ? nodes : [nodes]).some((node) => isTag2(node) && test(node) || hasChildren(node) && existsOne(test, node.children));
}
function findAll(test, nodes) {
  const result = [];
  const nodeStack = [Array.isArray(nodes) ? nodes : [nodes]];
  const indexStack = [0];
  for (; ; ) {
    if (indexStack[0] >= nodeStack[0].length) {
      if (nodeStack.length === 1) {
        return result;
      }
      nodeStack.shift();
      indexStack.shift();
      continue;
    }
    const element = nodeStack[0][indexStack[0]++];
    if (isTag2(element) && test(element))
      result.push(element);
    if (hasChildren(element) && element.children.length > 0) {
      indexStack.unshift(0);
      nodeStack.unshift(element.children);
    }
  }
}
var init_querying = __esm({
  "node_modules/domutils/dist/querying.js"() {
    init_dist3();
  }
});

// node_modules/domutils/dist/legacy.js
function getAttribCheck(attrib, value) {
  if (typeof value === "function") {
    return (element) => isTag2(element) && value(element.attribs[attrib]);
  }
  return (element) => isTag2(element) && element.attribs[attrib] === value;
}
function combineFuncs(a, b) {
  return (element) => a(element) || b(element);
}
function compileTest(options) {
  const funcs = Object.keys(options).map((key) => {
    const value = options[key];
    return Object.hasOwn(Checks, key) ? Checks[key](value) : getAttribCheck(key, value);
  });
  return funcs.length === 0 ? null : funcs.reduce(combineFuncs);
}
function testElement(options, node) {
  const test = compileTest(options);
  return test ? test(node) : true;
}
function getElements(options, nodes, recurse, limit = Number.POSITIVE_INFINITY) {
  const test = compileTest(options);
  return test ? filter(test, nodes, recurse, limit) : [];
}
function getElementById(id, nodes, recurse = true) {
  if (!Array.isArray(nodes))
    nodes = [nodes];
  return findOne(getAttribCheck("id", id), nodes, recurse);
}
function getElementsByTagName(tagName, nodes, recurse = true, limit = Number.POSITIVE_INFINITY) {
  return filter(Checks["tag_name"](tagName), nodes, recurse, limit);
}
function getElementsByClassName(className, nodes, recurse = true, limit = Number.POSITIVE_INFINITY) {
  return filter(getAttribCheck("class", className), nodes, recurse, limit);
}
function getElementsByTagType(type, nodes, recurse = true, limit = Number.POSITIVE_INFINITY) {
  return filter(Checks["tag_type"](type), nodes, recurse, limit);
}
var Checks;
var init_legacy = __esm({
  "node_modules/domutils/dist/legacy.js"() {
    init_dist3();
    init_querying();
    Checks = {
      tag_name(name) {
        if (typeof name === "function") {
          return (element) => isTag2(element) && name(element.name);
        }
        if (name === "*") {
          return isTag2;
        }
        return (element) => isTag2(element) && element.name === name;
      },
      tag_type(type) {
        if (typeof type === "function") {
          return (element) => type(element.type);
        }
        return (element) => element.type === type;
      },
      tag_contains(data) {
        if (typeof data === "function") {
          return (element) => isText(element) && data(element.data);
        }
        return (element) => isText(element) && element.data === data;
      }
    };
  }
});

// node_modules/dom-serializer/dist/foreign-names.js
var elementNames, attributeNames;
var init_foreign_names = __esm({
  "node_modules/dom-serializer/dist/foreign-names.js"() {
    elementNames = new Map("altGlyph altGlyphDef altGlyphItem animateColor animateMotion animateTransform clipPath feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence foreignObject glyphRef linearGradient radialGradient textPath".split(" ").map((name) => [name.toLowerCase(), name]));
    attributeNames = new Map("definitionURL attributeName attributeType baseFrequency baseProfile calcMode clipPathUnits diffuseConstant edgeMode filterUnits glyphRef gradientTransform gradientUnits kernelMatrix kernelUnitLength keyPoints keySplines keyTimes lengthAdjust limitingConeAngle markerHeight markerUnits markerWidth maskContentUnits maskUnits numOctaves pathLength patternContentUnits patternTransform patternUnits pointsAtX pointsAtY pointsAtZ preserveAlpha preserveAspectRatio primitiveUnits refX refY repeatCount repeatDur requiredExtensions requiredFeatures specularConstant specularExponent spreadMethod startOffset stdDeviation stitchTiles surfaceScale systemLanguage tableValues targetX targetY textLength viewBox viewTarget xChannelSelector yChannelSelector zoomAndPan".split(" ").map((name) => [name.toLowerCase(), name]));
  }
});

// node_modules/dom-serializer/dist/index.js
function render(node, options = {}) {
  const nodes = "length" in node ? node : [node];
  const xmlMode = options.xmlMode ?? false;
  let output = "";
  for (let index = 0; index < nodes.length; index++) {
    output += renderNode(nodes[index], options, xmlMode);
  }
  return output;
}
function renderChildren(children, options, xmlMode) {
  let output = "";
  for (let index = 0; index < children.length; index++) {
    output += renderNode(children[index], options, xmlMode);
  }
  return output;
}
function renderNode(node, options, xmlMode) {
  switch (node.type) {
    case Root: {
      return renderChildren(node.children, options, xmlMode);
    }
    case Directive: {
      return `<${node.data}>`;
    }
    case Comment: {
      return `<!--${node.data}-->`;
    }
    case CDATA: {
      return `<![CDATA[${node.children[0].data}]]>`;
    }
    case Script:
    case Style:
    case Tag: {
      return renderTag(node, options, xmlMode);
    }
    case Text: {
      const element = node;
      const data = element.data || "";
      if ((options.encodeEntities ?? options.decodeEntities) !== false && !(!xmlMode && element.parent && unencodedElements.has(element.parent.name))) {
        return xmlMode || options.encodeEntities !== "utf8" ? encodeXML(data) : escapeText(data);
      }
      return data;
    }
  }
}
function renderTag(element, options, xmlMode) {
  if (xmlMode === "foreign") {
    element.name = elementNames.get(element.name) ?? element.name;
    if (element.parent && foreignModeIntegrationPoints.has(element.parent.name)) {
      xmlMode = false;
    }
  }
  if (!xmlMode && foreignElements.has(element.name)) {
    xmlMode = "foreign";
  }
  const { name, children } = element;
  const isVoid = !xmlMode && voidElements2.has(name);
  let tag = `<${name}${formatAttributes(element.attribs, options, xmlMode)}`;
  if (children.length === 0 && (xmlMode ? options.selfClosingTags !== false : options.selfClosingTags && isVoid)) {
    tag += xmlMode ? "/>" : " />";
  } else {
    tag += ">";
    if (children.length > 0) {
      tag += renderChildren(children, options, xmlMode);
    }
    if (!isVoid) {
      tag += `</${name}>`;
    }
  }
  return tag;
}
function replaceQuotes(value) {
  return value.replaceAll('"', "&quot;");
}
function formatAttributes(attributes, options, xmlMode) {
  if (!attributes)
    return "";
  const encode3 = (options.encodeEntities ?? options.decodeEntities) === false ? replaceQuotes : xmlMode || options.encodeEntities !== "utf8" ? encodeXML : escapeAttribute;
  const isForeign = xmlMode === "foreign";
  const showEmpty = !!(options.emptyAttrs ?? xmlMode);
  let result = "";
  for (const key in attributes) {
    if (!Object.hasOwn(attributes, key))
      continue;
    const value = attributes[key];
    const k = isForeign ? attributeNames.get(key) ?? key : key;
    result += !showEmpty && (value == null || value === "") ? ` ${k}` : ` ${k}="${encode3(value == null ? "" : String(value))}"`;
  }
  return result;
}
var unencodedElements, voidElements2, foreignElements, foreignModeIntegrationPoints, dist_default;
var init_dist4 = __esm({
  "node_modules/dom-serializer/dist/index.js"() {
    init_dist2();
    init_dist();
    init_foreign_names();
    unencodedElements = new Set("style script xmp iframe noembed noframes plaintext noscript".split(" "));
    voidElements2 = new Set("area base basefont br col command embed frame hr img input isindex keygen link meta param source track wbr".split(" "));
    foreignElements = /* @__PURE__ */ new Set(["svg", "math"]);
    foreignModeIntegrationPoints = new Set("mi mo mn ms mtext annotation-xml foreignObject desc title".split(" "));
    dist_default = render;
  }
});

// node_modules/domutils/dist/stringify.js
function getOuterHTML(node, options) {
  return dist_default(node, options);
}
function getInnerHTML(node, options) {
  return hasChildren(node) ? node.children.map((node2) => getOuterHTML(node2, options)).join("") : "";
}
function getText(node) {
  if (Array.isArray(node))
    return node.map(getText).join("");
  if (isTag2(node))
    return node.name === "br" ? "\n" : getText(node.children);
  if (isCDATA(node))
    return getText(node.children);
  if (isText(node))
    return node.data;
  return "";
}
function textContent(node) {
  if (Array.isArray(node))
    return node.map(textContent).join("");
  if (hasChildren(node) && !isComment(node)) {
    return textContent(node.children);
  }
  if (isText(node))
    return node.data;
  return "";
}
function innerText(node) {
  if (Array.isArray(node))
    return node.map(innerText).join("");
  if (hasChildren(node) && (node.type === ElementType.Tag || isCDATA(node))) {
    return innerText(node.children);
  }
  if (isText(node))
    return node.data;
  return "";
}
var init_stringify = __esm({
  "node_modules/domutils/dist/stringify.js"() {
    init_dist4();
    init_dist2();
    init_dist3();
  }
});

// node_modules/domutils/dist/feeds.js
function getFeed(document) {
  const feedRoot = getOneElement(isValidFeed, document);
  return feedRoot ? feedRoot.name === "feed" ? getAtomFeed(feedRoot) : getRssFeed(feedRoot) : null;
}
function getAtomFeed(feedRoot) {
  const childs = feedRoot.children;
  const feed = {
    type: "atom",
    items: getElementsByTagName("entry", childs).map((item) => {
      const { children } = item;
      const entry = { media: getMediaElements(children) };
      addConditionally(entry, "id", "id", children);
      addConditionally(entry, "title", "title", children);
      const href2 = getOneElement("link", children)?.attribs["href"];
      if (href2) {
        entry.link = href2;
      }
      const description = fetch("summary", children) || fetch("content", children);
      if (description) {
        entry.description = description;
      }
      const pubDate = fetch("updated", children);
      if (pubDate) {
        entry.pubDate = new Date(pubDate);
      }
      return entry;
    })
  };
  addConditionally(feed, "id", "id", childs);
  addConditionally(feed, "title", "title", childs);
  const href = getOneElement("link", childs)?.attribs["href"];
  if (href) {
    feed.link = href;
  }
  addConditionally(feed, "description", "subtitle", childs);
  const updated = fetch("updated", childs);
  if (updated) {
    feed.updated = new Date(updated);
  }
  addConditionally(feed, "author", "email", childs, true);
  return feed;
}
function getRssFeed(feedRoot) {
  const childs = getOneElement("channel", feedRoot.children)?.children ?? [];
  const feed = {
    type: feedRoot.name.substr(0, 3),
    id: "",
    items: getElementsByTagName("item", feedRoot.children).map((item) => {
      const { children } = item;
      const entry = { media: getMediaElements(children) };
      addConditionally(entry, "id", "guid", children);
      addConditionally(entry, "title", "title", children);
      addConditionally(entry, "link", "link", children);
      addConditionally(entry, "description", "description", children);
      const pubDate = fetch("pubDate", children) || fetch("dc:date", children);
      if (pubDate)
        entry.pubDate = new Date(pubDate);
      return entry;
    })
  };
  addConditionally(feed, "title", "title", childs);
  addConditionally(feed, "link", "link", childs);
  addConditionally(feed, "description", "description", childs);
  const updated = fetch("lastBuildDate", childs);
  if (updated) {
    feed.updated = new Date(updated);
  }
  addConditionally(feed, "author", "managingEditor", childs, true);
  return feed;
}
function getMediaElements(where) {
  return getElementsByTagName("media:content", where).map((element) => {
    const { attribs } = element;
    const media = {
      medium: attribs["medium"],
      isDefault: !!attribs["isDefault"]
    };
    for (const attrib of MEDIA_KEYS_STRING) {
      if (attribs[attrib]) {
        media[attrib] = attribs[attrib];
      }
    }
    for (const attrib of MEDIA_KEYS_INT) {
      if (attribs[attrib]) {
        media[attrib] = Number.parseInt(attribs[attrib], 10);
      }
    }
    if (attribs["expression"]) {
      media.expression = attribs["expression"];
    }
    return media;
  });
}
function getOneElement(tagName, node) {
  return getElementsByTagName(tagName, node, true, 1)[0];
}
function fetch(tagName, where, recurse = false) {
  return textContent(getElementsByTagName(tagName, where, recurse, 1)).trim();
}
function addConditionally(object, property, tagName, where, recurse = false) {
  const value = fetch(tagName, where, recurse);
  if (value)
    object[property] = value;
}
function isValidFeed(value) {
  return value === "rss" || value === "feed" || value === "rdf:RDF";
}
var MEDIA_KEYS_STRING, MEDIA_KEYS_INT;
var init_feeds = __esm({
  "node_modules/domutils/dist/feeds.js"() {
    init_legacy();
    init_stringify();
    MEDIA_KEYS_STRING = ["url", "type", "lang"];
    MEDIA_KEYS_INT = [
      "fileSize",
      "bitrate",
      "framerate",
      "samplingrate",
      "channels",
      "duration",
      "height",
      "width"
    ];
  }
});

// node_modules/domutils/dist/helpers.js
function removeSubsets(nodes) {
  let index = nodes.length;
  while (--index >= 0) {
    const node = nodes[index];
    if (index > 0 && nodes.lastIndexOf(node, index - 1) >= 0) {
      nodes.splice(index, 1);
      continue;
    }
    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
      if (nodes.includes(ancestor)) {
        nodes.splice(index, 1);
        break;
      }
    }
  }
  return nodes;
}
function compareDocumentPosition(nodeA, nodeB) {
  const aParents = [];
  const bParents = [];
  if (nodeA === nodeB) {
    return 0;
  }
  let current = hasChildren(nodeA) ? nodeA : nodeA.parent;
  while (current) {
    aParents.unshift(current);
    current = current.parent;
  }
  current = hasChildren(nodeB) ? nodeB : nodeB.parent;
  while (current) {
    bParents.unshift(current);
    current = current.parent;
  }
  const maxIndex = Math.min(aParents.length, bParents.length);
  let index = 0;
  while (index < maxIndex && aParents[index] === bParents[index]) {
    index++;
  }
  if (index === 0) {
    return DocumentPosition.DISCONNECTED;
  }
  const sharedParent = aParents[index - 1];
  const siblings = sharedParent.children;
  const aSibling = aParents[index];
  const bSibling = bParents[index];
  if (siblings.indexOf(aSibling) > siblings.indexOf(bSibling)) {
    if (sharedParent === nodeB) {
      return DocumentPosition.FOLLOWING | DocumentPosition.CONTAINED_BY;
    }
    return DocumentPosition.FOLLOWING;
  }
  if (sharedParent === nodeA) {
    return DocumentPosition.PRECEDING | DocumentPosition.CONTAINS;
  }
  return DocumentPosition.PRECEDING;
}
function uniqueSort(nodes) {
  nodes = nodes.filter((node, index, array) => !array.includes(node, index + 1));
  nodes.sort((a, b) => {
    const relative = compareDocumentPosition(a, b);
    if (relative & DocumentPosition.PRECEDING) {
      return -1;
    }
    if (relative & DocumentPosition.FOLLOWING) {
      return 1;
    }
    return 0;
  });
  return nodes;
}
var DocumentPosition;
var init_helpers = __esm({
  "node_modules/domutils/dist/helpers.js"() {
    init_dist3();
    (function(DocumentPosition2) {
      DocumentPosition2[DocumentPosition2["DISCONNECTED"] = 1] = "DISCONNECTED";
      DocumentPosition2[DocumentPosition2["PRECEDING"] = 2] = "PRECEDING";
      DocumentPosition2[DocumentPosition2["FOLLOWING"] = 4] = "FOLLOWING";
      DocumentPosition2[DocumentPosition2["CONTAINS"] = 8] = "CONTAINS";
      DocumentPosition2[DocumentPosition2["CONTAINED_BY"] = 16] = "CONTAINED_BY";
    })(DocumentPosition || (DocumentPosition = {}));
  }
});

// node_modules/domutils/dist/manipulation.js
function removeElement(element) {
  if (element.prev)
    element.prev.next = element.next;
  if (element.next)
    element.next.prev = element.prev;
  if (element.parent) {
    const childs = element.parent.children;
    const childsIndex = childs.lastIndexOf(element);
    if (childsIndex !== -1) {
      childs.splice(childsIndex, 1);
    }
  }
  element.next = null;
  element.prev = null;
  element.parent = null;
}
function replaceElement(element, replacement) {
  replacement.prev = element.prev;
  if (replacement.prev) {
    replacement.prev.next = replacement;
  }
  replacement.next = element.next;
  if (replacement.next) {
    replacement.next.prev = replacement;
  }
  replacement.parent = element.parent;
  if (replacement.parent) {
    const { children } = replacement.parent;
    const elementIndex = children.lastIndexOf(element);
    if (elementIndex === -1) {
      return;
    }
    children[elementIndex] = replacement;
    element.parent = null;
  }
}
function appendChild(parent, child) {
  removeElement(child);
  child.next = null;
  child.parent = parent;
  if (parent.children.push(child) > 1) {
    const sibling = parent.children[parent.children.length - 2];
    sibling.next = child;
    child.prev = sibling;
  } else {
    child.prev = null;
  }
}
function append2(element, next) {
  removeElement(next);
  const { parent } = element;
  const currentNext = element.next;
  next.next = currentNext;
  next.prev = element;
  element.next = next;
  next.parent = parent;
  if (currentNext) {
    currentNext.prev = next;
    if (parent) {
      const childs = parent.children;
      childs.splice(childs.lastIndexOf(currentNext), 0, next);
    }
  } else if (parent) {
    parent.children.push(next);
  }
}
function prependChild(parent, child) {
  removeElement(child);
  child.parent = parent;
  child.prev = null;
  if (parent.children.unshift(child) === 1) {
    child.next = null;
  } else {
    const sibling = parent.children[1];
    sibling.prev = child;
    child.next = sibling;
  }
}
function prepend(element, previous) {
  removeElement(previous);
  const { parent } = element;
  if (parent) {
    const childs = parent.children;
    childs.splice(childs.indexOf(element), 0, previous);
  }
  if (element.prev) {
    element.prev.next = previous;
  }
  previous.parent = parent;
  previous.prev = element.prev;
  previous.next = element;
  element.prev = previous;
}
var init_manipulation = __esm({
  "node_modules/domutils/dist/manipulation.js"() {
  }
});

// node_modules/domutils/dist/traversal.js
function getChildren(element) {
  return hasChildren(element) ? element.children : [];
}
function getParent(element) {
  return element.parent || null;
}
function getSiblings(element) {
  const parent = getParent(element);
  if (parent != null)
    return getChildren(parent);
  const siblings = [element];
  let { prev, next } = element;
  while (prev != null) {
    siblings.unshift(prev);
    ({ prev } = prev);
  }
  while (next != null) {
    siblings.push(next);
    ({ next } = next);
  }
  return siblings;
}
function getAttributeValue(element, name) {
  const { attribs } = element;
  return attribs?.[name];
}
function hasAttrib(element, name) {
  const { attribs } = element;
  return attribs != null && Object.hasOwn(attribs, name) && attribs[name] != null;
}
function getName(element) {
  return element.name;
}
function nextElementSibling(element) {
  let { next } = element;
  while (next !== null && !isTag2(next))
    ({ next } = next);
  return next;
}
function prevElementSibling(element) {
  let { prev } = element;
  while (prev !== null && !isTag2(prev))
    ({ prev } = prev);
  return prev;
}
var init_traversal = __esm({
  "node_modules/domutils/dist/traversal.js"() {
    init_dist3();
  }
});

// node_modules/domutils/dist/index.js
var dist_exports3 = {};
__export(dist_exports3, {
  DocumentPosition: () => DocumentPosition,
  append: () => append2,
  appendChild: () => appendChild,
  compareDocumentPosition: () => compareDocumentPosition,
  existsOne: () => existsOne,
  filter: () => filter,
  find: () => find,
  findAll: () => findAll,
  findOne: () => findOne,
  getAttributeValue: () => getAttributeValue,
  getChildren: () => getChildren,
  getElementById: () => getElementById,
  getElements: () => getElements,
  getElementsByClassName: () => getElementsByClassName,
  getElementsByTagName: () => getElementsByTagName,
  getElementsByTagType: () => getElementsByTagType,
  getFeed: () => getFeed,
  getInnerHTML: () => getInnerHTML,
  getName: () => getName,
  getOuterHTML: () => getOuterHTML,
  getParent: () => getParent,
  getSiblings: () => getSiblings,
  getText: () => getText,
  hasAttrib: () => hasAttrib,
  innerText: () => innerText,
  nextElementSibling: () => nextElementSibling,
  prepend: () => prepend,
  prependChild: () => prependChild,
  prevElementSibling: () => prevElementSibling,
  removeElement: () => removeElement,
  removeSubsets: () => removeSubsets,
  replaceElement: () => replaceElement,
  testElement: () => testElement,
  textContent: () => textContent,
  uniqueSort: () => uniqueSort
});
var init_dist5 = __esm({
  "node_modules/domutils/dist/index.js"() {
    init_feeds();
    init_helpers();
    init_legacy();
    init_manipulation();
    init_querying();
    init_stringify();
    init_traversal();
  }
});

// node_modules/htmlparser2/dist/index.js
var dist_exports4 = {};
__export(dist_exports4, {
  DefaultHandler: () => DomHandler,
  DomHandler: () => DomHandler,
  DomUtils: () => dist_exports3,
  ElementType: () => dist_exports2,
  Parser: () => Parser2,
  QuoteType: () => QuoteType,
  Tokenizer: () => Tokenizer,
  createDocumentStream: () => createDocumentStream,
  getFeed: () => getFeed,
  parseDocument: () => parseDocument2,
  parseFeed: () => parseFeed
});
function parseDocument2(data, options) {
  const handler = new DomHandler(void 0, options);
  new Parser2(handler, options).end(data);
  return handler.root;
}
function createDocumentStream(callback, options, elementCallback) {
  const handler = new DomHandler((error2) => callback(error2, handler.root), options, elementCallback);
  return new Parser2(handler, options);
}
function parseFeed(feed, options = parseFeedDefaultOptions) {
  return getFeed(parseDocument2(feed, options).children);
}
var parseFeedDefaultOptions;
var init_dist6 = __esm({
  "node_modules/htmlparser2/dist/index.js"() {
    init_Parser();
    init_Parser();
    init_dist3();
    init_dist3();
    init_dist2();
    init_Tokenizer();
    init_dist5();
    init_dist5();
    init_dist5();
    parseFeedDefaultOptions = { xmlMode: true };
  }
});

// node_modules/escape-string-regexp/index.js
var require_escape_string_regexp = __commonJS({
  "node_modules/escape-string-regexp/index.js"(exports, module) {
    "use strict";
    module.exports = (string2) => {
      if (typeof string2 !== "string") {
        throw new TypeError("Expected a string");
      }
      return string2.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
    };
  }
});

// node_modules/is-plain-object/dist/is-plain-object.js
var require_is_plain_object = __commonJS({
  "node_modules/is-plain-object/dist/is-plain-object.js"(exports) {
    "use strict";
    function isObject(o) {
      return Object.prototype.toString.call(o) === "[object Object]";
    }
    function isPlainObject(o) {
      var ctor, prot;
      if (isObject(o) === false) return false;
      ctor = o.constructor;
      if (ctor === void 0) return true;
      prot = ctor.prototype;
      if (isObject(prot) === false) return false;
      if (prot.hasOwnProperty("isPrototypeOf") === false) {
        return false;
      }
      return true;
    }
    exports.isPlainObject = isPlainObject;
  }
});

// node_modules/parse-srcset/src/parse-srcset.js
var require_parse_srcset = __commonJS({
  "node_modules/parse-srcset/src/parse-srcset.js"(exports, module) {
    (function(root, factory) {
      if (typeof define === "function" && define.amd) {
        define([], factory);
      } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
      } else {
        root.parseSrcset = factory();
      }
    })(exports, function() {
      return function(input) {
        function isSpace2(c2) {
          return c2 === " " || // space
          c2 === "	" || // horizontal tab
          c2 === "\n" || // new line
          c2 === "\f" || // form feed
          c2 === "\r";
        }
        function collectCharacters(regEx) {
          var chars, match = regEx.exec(input.substring(pos));
          if (match) {
            chars = match[0];
            pos += chars.length;
            return chars;
          }
        }
        var inputLength = input.length, regexLeadingSpaces = /^[ \t\n\r\u000c]+/, regexLeadingCommasOrSpaces = /^[, \t\n\r\u000c]+/, regexLeadingNotSpaces = /^[^ \t\n\r\u000c]+/, regexTrailingCommas = /[,]+$/, regexNonNegativeInteger = /^\d+$/, regexFloatingPoint = /^-?(?:[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/, url, descriptors, currentDescriptor, state, c, pos = 0, candidates = [];
        while (true) {
          collectCharacters(regexLeadingCommasOrSpaces);
          if (pos >= inputLength) {
            return candidates;
          }
          url = collectCharacters(regexLeadingNotSpaces);
          descriptors = [];
          if (url.slice(-1) === ",") {
            url = url.replace(regexTrailingCommas, "");
            parseDescriptors();
          } else {
            tokenize();
          }
        }
        function tokenize() {
          collectCharacters(regexLeadingSpaces);
          currentDescriptor = "";
          state = "in descriptor";
          while (true) {
            c = input.charAt(pos);
            if (state === "in descriptor") {
              if (isSpace2(c)) {
                if (currentDescriptor) {
                  descriptors.push(currentDescriptor);
                  currentDescriptor = "";
                  state = "after descriptor";
                }
              } else if (c === ",") {
                pos += 1;
                if (currentDescriptor) {
                  descriptors.push(currentDescriptor);
                }
                parseDescriptors();
                return;
              } else if (c === "(") {
                currentDescriptor = currentDescriptor + c;
                state = "in parens";
              } else if (c === "") {
                if (currentDescriptor) {
                  descriptors.push(currentDescriptor);
                }
                parseDescriptors();
                return;
              } else {
                currentDescriptor = currentDescriptor + c;
              }
            } else if (state === "in parens") {
              if (c === ")") {
                currentDescriptor = currentDescriptor + c;
                state = "in descriptor";
              } else if (c === "") {
                descriptors.push(currentDescriptor);
                parseDescriptors();
                return;
              } else {
                currentDescriptor = currentDescriptor + c;
              }
            } else if (state === "after descriptor") {
              if (isSpace2(c)) {
              } else if (c === "") {
                parseDescriptors();
                return;
              } else {
                state = "in descriptor";
                pos -= 1;
              }
            }
            pos += 1;
          }
        }
        function parseDescriptors() {
          var pError = false, w, d, h2, i, candidate = {}, desc, lastChar, value, intVal, floatVal;
          for (i = 0; i < descriptors.length; i++) {
            desc = descriptors[i];
            lastChar = desc[desc.length - 1];
            value = desc.substring(0, desc.length - 1);
            intVal = parseInt(value, 10);
            floatVal = parseFloat(value);
            if (regexNonNegativeInteger.test(value) && lastChar === "w") {
              if (w || d) {
                pError = true;
              }
              if (intVal === 0) {
                pError = true;
              } else {
                w = intVal;
              }
            } else if (regexFloatingPoint.test(value) && lastChar === "x") {
              if (w || d || h2) {
                pError = true;
              }
              if (floatVal < 0) {
                pError = true;
              } else {
                d = floatVal;
              }
            } else if (regexNonNegativeInteger.test(value) && lastChar === "h") {
              if (h2 || d) {
                pError = true;
              }
              if (intVal === 0) {
                pError = true;
              } else {
                h2 = intVal;
              }
            } else {
              pError = true;
            }
          }
          if (!pError) {
            candidate.url = url;
            if (w) {
              candidate.w = w;
            }
            if (d) {
              candidate.d = d;
            }
            if (h2) {
              candidate.h = h2;
            }
            candidates.push(candidate);
          } else if (console && console.log) {
            console.log("Invalid srcset descriptor found in '" + input + "' at '" + desc + "'.");
          }
        }
      };
    });
  }
});

// stub:postcss
var require_postcss = __commonJS({
  "stub:postcss"(exports, module) {
    module.exports = { parse() {
      throw new Error("postcss \u306F\u914D\u5E03\u7269\u306B\u542B\u3081\u306A\u3044");
    } };
  }
});

// node_modules/dayjs/dayjs.min.js
var require_dayjs_min = __commonJS({
  "node_modules/dayjs/dayjs.min.js"(exports, module) {
    !(function(t, e) {
      "object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : (t = "undefined" != typeof globalThis ? globalThis : t || self).dayjs = e();
    })(exports, (function() {
      "use strict";
      var t = 1e3, e = 6e4, n = 36e5, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", c = "month", f = "quarter", h2 = "year", d = "date", l = "Invalid Date", $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|YYYY|YY|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(t2) {
        var e2 = ["th", "st", "nd", "rd"], n2 = t2 % 100;
        return "[" + t2 + (e2[(n2 - 20) % 10] || e2[n2] || e2[0]) + "]";
      } }, m = function(t2, e2, n2) {
        var r2 = String(t2);
        return !r2 || r2.length >= e2 ? t2 : "" + Array(e2 + 1 - r2.length).join(n2) + t2;
      }, v = { s: m, z: function(t2) {
        var e2 = -t2.utcOffset(), n2 = Math.abs(e2), r2 = Math.floor(n2 / 60), i2 = n2 % 60;
        return (e2 <= 0 ? "+" : "-") + m(r2, 2, "0") + ":" + m(i2, 2, "0");
      }, m: function t2(e2, n2) {
        if (e2.date() < n2.date()) return -t2(n2, e2);
        var r2 = 12 * (n2.year() - e2.year()) + (n2.month() - e2.month()), i2 = e2.clone().add(r2, c), s2 = n2 - i2 < 0, u2 = e2.clone().add(r2 + (s2 ? -1 : 1), c);
        return +(-(r2 + (n2 - i2) / (s2 ? i2 - u2 : u2 - i2)) || 0);
      }, a: function(t2) {
        return t2 < 0 ? Math.ceil(t2) || 0 : Math.floor(t2);
      }, p: function(t2) {
        return { M: c, y: h2, w: o, d: a, D: d, h: u, m: s, s: i, ms: r, Q: f }[t2] || String(t2 || "").toLowerCase().replace(/s$/, "");
      }, u: function(t2) {
        return void 0 === t2;
      } }, g = "en", D = {};
      D[g] = M;
      var p = "$isDayjsObject", S2 = function(t2) {
        return t2 instanceof _ || !(!t2 || !t2[p]);
      }, w = function t2(e2, n2, r2) {
        var i2;
        if (!e2) return g;
        if ("string" == typeof e2) {
          var s2 = e2.toLowerCase();
          D[s2] && (i2 = s2), n2 && (D[s2] = n2, i2 = s2);
          var u2 = e2.split("-");
          if (!i2 && u2.length > 1) return t2(u2[0]);
        } else {
          var a2 = e2.name;
          D[a2] = e2, i2 = a2;
        }
        return !r2 && i2 && (g = i2), i2 || !r2 && g;
      }, O = function(t2, e2) {
        if (S2(t2)) return t2.clone();
        var n2 = "object" == typeof e2 ? e2 : {};
        return n2.date = t2, n2.args = arguments, new _(n2);
      }, b = v;
      b.l = w, b.i = S2, b.w = function(t2, e2) {
        return O(t2, { locale: e2.$L, utc: e2.$u, x: e2.$x, $offset: e2.$offset });
      };
      var _ = (function() {
        function M2(t2) {
          this.$L = w(t2.locale, null, true), this.parse(t2), this.$x = this.$x || t2.x || {}, this[p] = true;
        }
        var m2 = M2.prototype;
        return m2.parse = function(t2) {
          this.$d = (function(t3) {
            var e2 = t3.date, n2 = t3.utc;
            if (null === e2) return /* @__PURE__ */ new Date(NaN);
            if (b.u(e2)) return /* @__PURE__ */ new Date();
            if (e2 instanceof Date) return new Date(e2);
            if ("string" == typeof e2 && !/Z$/i.test(e2)) {
              var r2 = e2.match($);
              if (r2) {
                var i2 = r2[2] - 1 || 0, s2 = (r2[7] || "0").substring(0, 3);
                return n2 ? new Date(Date.UTC(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2)) : new Date(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2);
              }
            }
            return new Date(e2);
          })(t2), this.init();
        }, m2.init = function() {
          var t2 = this.$d;
          this.$y = t2.getFullYear(), this.$M = t2.getMonth(), this.$D = t2.getDate(), this.$W = t2.getDay(), this.$H = t2.getHours(), this.$m = t2.getMinutes(), this.$s = t2.getSeconds(), this.$ms = t2.getMilliseconds();
        }, m2.$utils = function() {
          return b;
        }, m2.isValid = function() {
          return !(this.$d.toString() === l);
        }, m2.isSame = function(t2, e2) {
          var n2 = O(t2);
          return this.startOf(e2) <= n2 && n2 <= this.endOf(e2);
        }, m2.isAfter = function(t2, e2) {
          return O(t2) < this.startOf(e2);
        }, m2.isBefore = function(t2, e2) {
          return this.endOf(e2) < O(t2);
        }, m2.$g = function(t2, e2, n2) {
          return b.u(t2) ? this[e2] : this.set(n2, t2);
        }, m2.unix = function() {
          return Math.floor(this.valueOf() / 1e3);
        }, m2.valueOf = function() {
          return this.$d.getTime();
        }, m2.startOf = function(t2, e2) {
          var n2 = this, r2 = !!b.u(e2) || e2, f2 = b.p(t2), l2 = function(t3, e3) {
            var i2 = b.w(n2.$u ? Date.UTC(n2.$y, e3, t3) : new Date(n2.$y, e3, t3), n2);
            return r2 ? i2 : i2.endOf(a);
          }, $2 = function(t3, e3) {
            return b.w(n2.toDate()[t3].apply(n2.toDate("s"), (r2 ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(e3)), n2);
          }, y2 = this.$W, M3 = this.$M, m3 = this.$D, v2 = "set" + (this.$u ? "UTC" : "");
          switch (f2) {
            case h2:
              return r2 ? l2(1, 0) : l2(31, 11);
            case c:
              return r2 ? l2(1, M3) : l2(0, M3 + 1);
            case o:
              var g2 = this.$locale().weekStart || 0, D2 = (y2 < g2 ? y2 + 7 : y2) - g2;
              return l2(r2 ? m3 - D2 : m3 + (6 - D2), M3);
            case a:
            case d:
              return $2(v2 + "Hours", 0);
            case u:
              return $2(v2 + "Minutes", 1);
            case s:
              return $2(v2 + "Seconds", 2);
            case i:
              return $2(v2 + "Milliseconds", 3);
            default:
              return this.clone();
          }
        }, m2.endOf = function(t2) {
          return this.startOf(t2, false);
        }, m2.$set = function(t2, e2) {
          var n2, o2 = b.p(t2), f2 = "set" + (this.$u ? "UTC" : ""), l2 = (n2 = {}, n2[a] = f2 + "Date", n2[d] = f2 + "Date", n2[c] = f2 + "Month", n2[h2] = f2 + "FullYear", n2[u] = f2 + "Hours", n2[s] = f2 + "Minutes", n2[i] = f2 + "Seconds", n2[r] = f2 + "Milliseconds", n2)[o2], $2 = o2 === a ? this.$D + (e2 - this.$W) : e2;
          if (o2 === c || o2 === h2) {
            var y2 = this.clone().set(d, 1);
            y2.$d[l2]($2), y2.init(), this.$d = y2.set(d, Math.min(this.$D, y2.daysInMonth())).$d;
          } else l2 && this.$d[l2]($2);
          return this.init(), this;
        }, m2.set = function(t2, e2) {
          return this.clone().$set(t2, e2);
        }, m2.get = function(t2) {
          return this[b.p(t2)]();
        }, m2.add = function(r2, f2) {
          var d2, l2 = this;
          r2 = Number(r2);
          var $2 = b.p(f2), y2 = function(t2) {
            var e2 = O(l2);
            return b.w(e2.date(e2.date() + Math.round(t2 * r2)), l2);
          };
          if ($2 === c) return this.set(c, this.$M + r2);
          if ($2 === h2) return this.set(h2, this.$y + r2);
          if ($2 === a) return y2(1);
          if ($2 === o) return y2(7);
          var M3 = (d2 = {}, d2[s] = e, d2[u] = n, d2[i] = t, d2)[$2] || 1, m3 = this.$d.getTime() + r2 * M3;
          return b.w(m3, this);
        }, m2.subtract = function(t2, e2) {
          return this.add(-1 * t2, e2);
        }, m2.format = function(t2) {
          var e2 = this, n2 = this.$locale();
          if (!this.isValid()) return n2.invalidDate || l;
          var r2 = t2 || "YYYY-MM-DDTHH:mm:ssZ", i2 = b.z(this), s2 = this.$H, u2 = this.$m, a2 = this.$M, o2 = n2.weekdays, c2 = n2.months, f2 = n2.meridiem, h3 = function(t3, n3, i3, s3) {
            return t3 && (t3[n3] || t3(e2, r2)) || i3[n3].slice(0, s3);
          }, d2 = function(t3) {
            return b.s(s2 % 12 || 12, t3, "0");
          }, $2 = f2 || function(t3, e3, n3) {
            var r3 = t3 < 12 ? "AM" : "PM";
            return n3 ? r3.toLowerCase() : r3;
          };
          return r2.replace(y, (function(t3, r3) {
            return r3 || (function(t4) {
              switch (t4) {
                case "YY":
                  return String(e2.$y).slice(-2);
                case "YYYY":
                  return b.s(e2.$y, 4, "0");
                case "M":
                  return a2 + 1;
                case "MM":
                  return b.s(a2 + 1, 2, "0");
                case "MMM":
                  return h3(n2.monthsShort, a2, c2, 3);
                case "MMMM":
                  return h3(c2, a2);
                case "D":
                  return e2.$D;
                case "DD":
                  return b.s(e2.$D, 2, "0");
                case "d":
                  return String(e2.$W);
                case "dd":
                  return h3(n2.weekdaysMin, e2.$W, o2, 2);
                case "ddd":
                  return h3(n2.weekdaysShort, e2.$W, o2, 3);
                case "dddd":
                  return o2[e2.$W];
                case "H":
                  return String(s2);
                case "HH":
                  return b.s(s2, 2, "0");
                case "h":
                  return d2(1);
                case "hh":
                  return d2(2);
                case "a":
                  return $2(s2, u2, true);
                case "A":
                  return $2(s2, u2, false);
                case "m":
                  return String(u2);
                case "mm":
                  return b.s(u2, 2, "0");
                case "s":
                  return String(e2.$s);
                case "ss":
                  return b.s(e2.$s, 2, "0");
                case "SSS":
                  return b.s(e2.$ms, 3, "0");
                case "Z":
                  return i2;
              }
              return null;
            })(t3) || i2.replace(":", "");
          }));
        }, m2.utcOffset = function() {
          return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
        }, m2.diff = function(r2, d2, l2) {
          var $2, y2 = this, M3 = b.p(d2), m3 = O(r2), v2 = (m3.utcOffset() - this.utcOffset()) * e, g2 = this - m3, D2 = function() {
            return b.m(y2, m3);
          };
          switch (M3) {
            case h2:
              $2 = D2() / 12;
              break;
            case c:
              $2 = D2();
              break;
            case f:
              $2 = D2() / 3;
              break;
            case o:
              $2 = (g2 - v2) / 6048e5;
              break;
            case a:
              $2 = (g2 - v2) / 864e5;
              break;
            case u:
              $2 = g2 / n;
              break;
            case s:
              $2 = g2 / e;
              break;
            case i:
              $2 = g2 / t;
              break;
            default:
              $2 = g2;
          }
          return l2 ? $2 : b.a($2);
        }, m2.daysInMonth = function() {
          return this.endOf(c).$D;
        }, m2.$locale = function() {
          return D[this.$L];
        }, m2.locale = function(t2, e2) {
          if (!t2) return this.$L;
          var n2 = this.clone(), r2 = w(t2, e2, true);
          return r2 && (n2.$L = r2), n2;
        }, m2.clone = function() {
          return b.w(this.$d, this);
        }, m2.toDate = function() {
          return new Date(this.valueOf());
        }, m2.toJSON = function() {
          return this.isValid() ? this.toISOString() : null;
        }, m2.toISOString = function() {
          return this.$d.toISOString();
        }, m2.toString = function() {
          return this.$d.toUTCString();
        }, M2;
      })(), Y = _.prototype;
      return O.prototype = Y, [["$ms", r], ["$s", i], ["$m", s], ["$H", u], ["$W", a], ["$M", c], ["$y", h2], ["$D", d]].forEach((function(t2) {
        Y[t2[1]] = function(e2) {
          return this.$g(e2, t2[0], t2[1]);
        };
      })), O.extend = function(t2, e2) {
        return t2.$i || (t2(e2, _, O), t2.$i = true), O;
      }, O.locale = w, O.isDayjs = S2, O.unix = function(t2) {
        return O(1e3 * t2);
      }, O.en = D[g], O.Ls = D, O.p = {}, O;
    }));
  }
});

// node_modules/launder/index.js
var require_launder = __commonJS({
  "node_modules/launder/index.js"(exports, module) {
    var dayjs = require_dayjs_min();
    function cleanHref(href) {
      href = href.replace(/[\x00-\x20]+/g, "");
      while (true) {
        const firstIndex = href.indexOf("<!--");
        if (firstIndex === -1) {
          break;
        }
        const lastIndex = href.indexOf("-->", firstIndex + 4);
        if (lastIndex === -1) {
          break;
        }
        href = href.substring(0, firstIndex) + href.substring(lastIndex + 3);
      }
      return href;
    }
    function naughtyHref(href, options) {
      options = options || {};
      const allowedSchemes = options.allowedSchemes || ["http", "https", "ftp", "mailto", "tel", "sms"];
      const allowProtocolRelative = options.allowProtocolRelative !== false;
      if (typeof href !== "string") {
        return false;
      }
      href = cleanHref(href);
      const matches2 = href.match(/^([a-zA-Z][a-zA-Z0-9.\-+]*):/);
      if (!matches2) {
        if (href.match(/^[/\\]{2}/)) {
          return !allowProtocolRelative;
        }
        return false;
      }
      const scheme = matches2[1].toLowerCase();
      return allowedSchemes.indexOf(scheme) === -1;
    }
    module.exports = function(options) {
      const self2 = {};
      self2.options = options || {};
      self2.filterTag = self2.options.filterTag || function(tag) {
        tag = tag.trim();
        return tag.toLowerCase();
      };
      self2.string = function(s, def) {
        if (typeof s !== "string") {
          if (typeof s === "number" || typeof s === "boolean") {
            s += "";
          } else {
            s = "";
          }
        }
        s = s.trim();
        if (def !== void 0) {
          if (s === "") {
            s = def;
          }
        }
        return s;
      };
      self2.strings = function(strings) {
        if (!Array.isArray(strings)) {
          return [];
        }
        return strings.map(function(s) {
          return self2.string(s);
        });
      };
      self2.integer = function(i, def, min, max) {
        if (def === void 0) {
          def = 0;
        }
        if (typeof i === "number") {
          i = Math.floor(i);
        } else {
          try {
            i = parseInt(i, 10);
            if (isNaN(i)) {
              i = def;
            }
          } catch (e) {
            i = def;
          }
        }
        if (typeof min === "number" && i < min) {
          i = min;
        }
        if (typeof max === "number" && i > max) {
          i = max;
        }
        return i;
      };
      self2.padInteger = function(i, places) {
        let s = i + "";
        while (s.length < places) {
          s = "0" + s;
        }
        return s;
      };
      self2.float = function(i, def, min, max) {
        if (def === void 0) {
          def = 0;
        }
        if (!(typeof i === "number")) {
          try {
            i = parseFloat(i, 10);
            if (isNaN(i)) {
              i = def;
            }
          } catch (e) {
            i = def;
          }
        }
        if (typeof min === "number" && i < min) {
          i = min;
        }
        if (typeof max === "number" && i > max) {
          i = max;
        }
        return i;
      };
      self2.naughtyHref = naughtyHref;
      self2.url = function(s, def, httpsFix) {
        s = self2.string(s, def);
        if (s === def) {
          return s;
        }
        s = cleanHref(s);
        if (naughtyHref(s)) {
          return def;
        }
        s = fixUrl(s);
        if (s === null) {
          return def;
        }
        return s;
        function fixUrl(href) {
          if (href.match(/^(((https?|ftp):\/\/)|((mailto|tel|sms):)|#|([^/.]+)?\/|[^/.]+$)/)) {
            return href;
          } else if (href.match(/^[^/.]+\.[^/.]+/)) {
            const protocol = httpsFix ? "https://" : "http://";
            return protocol + href;
          } else {
            return null;
          }
        }
        ;
      };
      self2.select = function(s, choices, def) {
        s = self2.string(s);
        if (!choices || !choices.length) {
          return def;
        }
        let choice;
        if (typeof choices[0] === "object") {
          choice = choices.find(function(choice2) {
            if (choice2.value === null || choice2.value === void 0) {
              return false;
            }
            return choice2.value.toString() === s;
          });
          if (choice != null) {
            return choice.value;
          }
          return def;
        }
        choice = choices.find(function(choice2) {
          if (choice2 === null || choice2 === void 0) {
            return false;
          }
          return choice2.toString() === s;
        });
        if (choice !== void 0) {
          return choice;
        }
        return def;
      };
      self2.boolean = function(b, def) {
        if (b === true) {
          return true;
        }
        if (b === false) {
          return false;
        }
        b = self2.string(b, def);
        if (b === def) {
          if (b === void 0) {
            return false;
          }
          return b;
        }
        b = b.toLowerCase().charAt(0);
        if (b === "" || b === "n" || b === "0" || b === "f") {
          return false;
        }
        if (b === "t" || b === "y" || b === "1") {
          return true;
        }
        return false;
      };
      self2.addBooleanFilterToCriteria = function(options2, name, criteria, def) {
        if (def === void 0) {
          def = null;
        }
        let value = typeof options2 === "object" && options2 !== null ? options2[name] : options2;
        value = value === void 0 ? def : value;
        value = self2.booleanOrNull(value);
        if (value === null) {
        } else if (!value) {
          criteria[name] = { $ne: true };
        } else {
          criteria[name] = true;
        }
      };
      self2.booleanOrNull = function(b, def) {
        if (b === true) {
          return b;
        }
        if (b === false) {
          return b;
        }
        if (b === null) {
          return b;
        }
        b = self2.string(b, def);
        if (b === def) {
          if (def === void 0) {
            return null;
          }
          return b;
        }
        if (b === "null") {
          return null;
        }
        b = b.toLowerCase().charAt(0);
        if (b === "" || b === "n" || b === "0" || b === "f") {
          return false;
        }
        if (b === "t" || b === "y" || b === "1") {
          return true;
        }
        if (b === "a") {
          return null;
        }
        return def;
      };
      self2.date = function(date, def, now) {
        let components;
        function returnDefault() {
          if (def === void 0) {
            def = dayjs().format("YYYY-MM-DD");
          }
          return def;
        }
        if (typeof date === "string") {
          if (date.match(/\//)) {
            components = date.split("/");
            if (components.length === 2) {
              return (now || /* @__PURE__ */ new Date()).getFullYear() + "-" + self2.padInteger(components[0], 2) + "-" + self2.padInteger(components[1], 2);
            } else if (components.length === 3) {
              if (components[2] < 100) {
                const d = now || /* @__PURE__ */ new Date();
                const nowYear = d.getFullYear() % 100;
                const nowCentury = d.getFullYear() - nowYear;
                let theirYear = parseInt(components[2]) + nowCentury;
                if (theirYear - d.getFullYear() > 50) {
                  theirYear -= 100;
                }
                components[2] = theirYear;
              }
              return self2.padInteger(components[2], 4) + "-" + self2.padInteger(components[0], 2) + "-" + self2.padInteger(components[1], 2);
            } else {
              return returnDefault();
            }
          } else if (date.match(/-/)) {
            components = date.split("-");
            if (components.length === 2) {
              return (now || /* @__PURE__ */ new Date()).getFullYear() + "-" + self2.padInteger(components[0], 2) + "-" + self2.padInteger(components[1], 2);
            } else if (components.length === 3) {
              return self2.padInteger(components[0], 4) + "-" + self2.padInteger(components[1], 2) + "-" + self2.padInteger(components[2], 2);
            } else {
              return returnDefault();
            }
          }
        }
        try {
          if (date === null) {
            return returnDefault();
          }
          date = now || new Date(date);
          if (isNaN(date.getTime())) {
            return returnDefault();
          }
          return date.getFullYear() + "-" + self2.padInteger(date.getMonth() + 1, 2) + "-" + self2.padInteger(date.getDate(), 2);
        } catch (e) {
          return returnDefault();
        }
      };
      self2.formatDate = function(date) {
        return dayjs(date).format("YYYY-MM-DD");
      };
      self2.time = function(time, def) {
        time = self2.string(time).toLowerCase();
        time = time.trim();
        const components = time.match(/^(\d+)([:|.](\d+))?([:|.](\d+))?\s*(am|pm|AM|PM|a|p|A|M)?$/);
        if (components) {
          let hours = parseInt(components[1], 10);
          const minutes = components[3] !== void 0 ? parseInt(components[3], 10) : 0;
          const seconds = components[5] !== void 0 ? parseInt(components[5], 10) : 0;
          let ampm = components[6] ? components[6].toLowerCase() : components[6];
          ampm = ampm && ampm.charAt(0);
          if (hours === 12 && ampm === "a") {
            hours -= 12;
          } else if (hours === 12 && ampm === "p") {
          } else if (ampm === "p") {
            hours += 12;
          }
          if (hours === 24 || hours === "24") {
            hours = 0;
          }
          return self2.padInteger(hours, 2) + ":" + self2.padInteger(minutes, 2) + ":" + self2.padInteger(seconds, 2);
        } else {
          if (def !== void 0) {
            return def;
          }
          return dayjs().format("HH:mm");
        }
      };
      self2.formatTime = function(date) {
        return dayjs(date).format("HH:mm:ss");
      };
      self2.tags = function(tags, filter2) {
        if (typeof tags === "string") {
          tags = tags.split(/,\s*/);
        }
        if (!Array.isArray(tags)) {
          return [];
        }
        const strings = tags.map((tag) => self2.string(tag));
        const rewritten = strings.map(filter2 || self2.filterTag);
        const filtered = rewritten.filter((tag) => tag.length > 0);
        return filtered;
      };
      self2.idRegExp = self2.options.idRegExp || /^[A-Za-z0-9_]+$/;
      self2.id = function(s, def) {
        const id = self2.string(s, def);
        if (id === def) {
          return id;
        }
        if (!id.match(self2.idRegExp)) {
          return def;
        }
        return id;
      };
      self2.ids = function(ids) {
        if (!Array.isArray(ids)) {
          return [];
        }
        const result = ids.filter(function(id) {
          return self2.id(id) !== void 0;
        });
        return result;
      };
      return self2;
    };
    module.exports.naughtyHref = naughtyHref;
  }
});

// node_modules/sanitize-html/index.js
var require_sanitize_html = __commonJS({
  "node_modules/sanitize-html/index.js"(exports, module) {
    var htmlparser = (init_dist6(), __toCommonJS(dist_exports4));
    var escapeStringRegexp = require_escape_string_regexp();
    var { isPlainObject } = require_is_plain_object();
    var parseSrcset = require_parse_srcset();
    var { parse: postcssParse } = require_postcss();
    var { naughtyHref: launderNaughtyHref } = require_launder();
    var mediaTags = [
      "img",
      "audio",
      "video",
      "picture",
      "svg",
      "object",
      "map",
      "iframe",
      "embed"
    ];
    var vulnerableTags = ["script", "style"];
    var svgAnimationTags = [
      "animate",
      "animatecolor",
      "animatemotion",
      "animatetransform",
      "set"
    ];
    var alwaysUrlAttributes = ["href"];
    var severities = ["debug", "info", "warn", "error"];
    function loggerFor(options) {
      const source = options && options.logger || console;
      const logger = {};
      for (const severity of severities) {
        logger[severity] = typeof source[severity] === "function" ? (...args) => source[severity](...args) : (...args) => console[severity](...args);
      }
      return logger;
    }
    function each(obj, cb) {
      if (obj) {
        Object.keys(obj).forEach(function(key) {
          cb(obj[key], key);
        });
      }
    }
    function has(obj, key) {
      return {}.hasOwnProperty.call(obj, key);
    }
    function mergeClasses(specific, wildcard) {
      if (!Array.isArray(specific) || !Array.isArray(wildcard)) {
        return wildcard;
      }
      return specific.concat(wildcard);
    }
    function mergeStyles(specific, wildcard) {
      const merged = /* @__PURE__ */ Object.create(null);
      for (const rules of [specific, wildcard]) {
        for (const prop of Object.keys(rules)) {
          merged[prop] = has(merged, prop) ? merged[prop].concat(rules[prop]) : rules[prop];
        }
      }
      return merged;
    }
    function filter2(a, cb) {
      const n = [];
      each(a, function(v) {
        if (cb(v)) {
          n.push(v);
        }
      });
      return n;
    }
    function isEmptyObject(obj) {
      for (const key in obj) {
        if (has(obj, key)) {
          return false;
        }
      }
      return true;
    }
    function stringifySrcset(parsedSrcset) {
      return parsedSrcset.map(function(part) {
        if (!part.url) {
          throw new Error("URL missing");
        }
        return part.url + (part.w ? ` ${part.w}w` : "") + (part.h ? ` ${part.h}h` : "") + (part.d ? ` ${part.d}x` : "");
      }).join(", ");
    }
    module.exports = sanitizeHtml2;
    var VALID_HTML_ATTRIBUTE_NAME = /^[^\0\t\n\f\r /<=>]+$/;
    var MAX_IFRAME_FALLBACK_DEPTH = 8;
    function sanitizeHtml2(html, options, _fallback) {
      if (html == null) {
        return "";
      }
      const baseDepth = _fallback && _fallback.depth || 0;
      const iframeFallbackDepth = _fallback && _fallback.iframeFallbackDepth || 0;
      if (typeof html === "number") {
        html = html.toString();
      }
      let result = "";
      let tempResult = "";
      function Frame(tag, attribs) {
        const that = this;
        this.tag = tag;
        this.attribs = attribs || {};
        this.tagPosition = result.length;
        this.text = "";
        this.openingTagLength = 0;
        this.mediaChildren = [];
        this.updateParentNodeText = function() {
          if (stack.length) {
            const parentFrame = stack[stack.length - 1];
            parentFrame.text += that.text;
          }
        };
        this.updateParentNodeMediaChildren = function() {
          if (stack.length && mediaTags.includes(this.tag)) {
            const parentFrame = stack[stack.length - 1];
            parentFrame.mediaChildren.push(this.tag);
          }
        };
      }
      options = Object.assign({}, sanitizeHtml2.defaults, options);
      options.parser = Object.assign({}, htmlParserDefaults, options.parser);
      const logger = loggerFor(options);
      const tagAllowed = function(name) {
        return options.allowedTags === false || (options.allowedTags || []).indexOf(name) > -1;
      };
      vulnerableTags.forEach(function(tag) {
        if (tagAllowed(tag) && !options.allowVulnerableTags) {
          logger.warn(
            `Your \`allowedTags\` option includes \`${tag}\`, which is inherently vulnerable to XSS attacks. Please remove it from \`allowedTags\`, or, to disable this warning, add the \`allowVulnerableTags\` option and ensure you are accounting for this risk.`
          );
        }
      });
      const nonTextTagsArray = options.nonTextTags || [
        "script",
        "style",
        "textarea",
        "option",
        "xmp"
      ];
      let allowedAttributesMap;
      let allowedAttributesGlobMap;
      if (options.allowedAttributes) {
        allowedAttributesMap = {};
        allowedAttributesGlobMap = {};
        each(options.allowedAttributes, function(attributes, tag) {
          allowedAttributesMap[tag] = [];
          const globRegex = [];
          attributes.forEach(function(obj) {
            if (typeof obj === "string" && obj.indexOf("*") >= 0) {
              globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, ".*"));
            } else {
              allowedAttributesMap[tag].push(obj);
            }
          });
          if (globRegex.length) {
            allowedAttributesGlobMap[tag] = new RegExp("^(" + globRegex.join("|") + ")$");
          }
        });
      }
      const allowedClassesMap = {};
      const allowedClassesGlobMap = {};
      const allowedClassesRegexMap = {};
      each(options.allowedClasses, function(classes, tag) {
        if (allowedAttributesMap) {
          if (!has(allowedAttributesMap, tag)) {
            allowedAttributesMap[tag] = [];
          }
          allowedAttributesMap[tag].push("class");
        }
        allowedClassesMap[tag] = classes;
        if (Array.isArray(classes)) {
          const globRegex = [];
          allowedClassesMap[tag] = [];
          allowedClassesRegexMap[tag] = [];
          classes.forEach(function(obj) {
            if (typeof obj === "string" && obj.indexOf("*") >= 0) {
              globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, ".*"));
            } else if (obj instanceof RegExp) {
              allowedClassesRegexMap[tag].push(obj);
            } else {
              allowedClassesMap[tag].push(obj);
            }
          });
          if (globRegex.length) {
            allowedClassesGlobMap[tag] = new RegExp("^(" + globRegex.join("|") + ")$");
          }
        }
      });
      const transformTagsMap = {};
      let transformTagsAll;
      each(options.transformTags, function(transform, tag) {
        let transFun;
        if (typeof transform === "function") {
          transFun = transform;
        } else if (typeof transform === "string") {
          transFun = sanitizeHtml2.simpleTransform(transform);
        }
        if (tag === "*") {
          transformTagsAll = transFun;
        } else {
          transformTagsMap[tag] = transFun;
        }
      });
      let depth;
      let stack;
      let skipMap;
      let transformMap;
      let skipText;
      let skipTextDepth;
      let rawTextEnd;
      let skipRawText;
      let addedText = false;
      initializeState();
      const parser2 = new htmlparser.Parser({
        onopentag: function(name, attribs) {
          if (options.onOpenTag) {
            options.onOpenTag(name, attribs);
          }
          updateRawTextRegion();
          if (options.enforceHtmlBoundary && name === "html") {
            initializeState();
          }
          if (skipRawText) {
            return;
          }
          if (skipText) {
            skipTextDepth++;
            return;
          }
          const frame = new Frame(name, attribs);
          stack.push(frame);
          let skip = false;
          const hasText = !!frame.text;
          let transformedTag;
          if (has(transformTagsMap, name)) {
            transformedTag = transformTagsMap[name](name, attribs);
            frame.attribs = attribs = transformedTag.attribs;
            if (transformedTag.text !== void 0) {
              frame.innerText = transformedTag.text;
            }
            if (name !== transformedTag.tagName) {
              frame.name = name = transformedTag.tagName;
              transformMap[depth] = transformedTag.tagName;
            }
          }
          if (transformTagsAll) {
            transformedTag = transformTagsAll(name, attribs);
            frame.attribs = attribs = transformedTag.attribs;
            if (name !== transformedTag.tagName) {
              frame.name = name = transformedTag.tagName;
              transformMap[depth] = transformedTag.tagName;
            }
          }
          if (!tagAllowed(name) || animatesUrlAttribute(name, attribs) || options.disallowedTagsMode === "recursiveEscape" && !isEmptyObject(skipMap) || options.nestingLimit != null && depth >= options.nestingLimit) {
            skip = true;
            skipMap[depth] = true;
            if (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") {
              if (nonTextTagsArray.indexOf(name) !== -1) {
                skipText = true;
                skipTextDepth = 1;
                if (frame.tag.toLowerCase() === "noscript") {
                  rawTextEnd = findRawTextEnd("noscript", parser2.endIndex + 1);
                }
              }
            }
          }
          depth++;
          if (skip) {
            if (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") {
              if (frame.innerText && !hasText) {
                const escaped = escapeHtml3(frame.innerText);
                if (options.textFilter) {
                  result += options.textFilter(escaped, name);
                } else {
                  result += escaped;
                }
                addedText = true;
              }
              return;
            }
            tempResult = result;
            result = "";
          }
          result += "<" + name;
          if (name === "script") {
            if (options.allowedScriptHostnames || options.allowedScriptDomains) {
              frame.innerText = "";
            }
          }
          const isBeingEscaped = skip && (options.disallowedTagsMode === "escape" || options.disallowedTagsMode === "recursiveEscape");
          const shouldPreserveEscapedAttributes = isBeingEscaped && options.preserveEscapedAttributes;
          if (shouldPreserveEscapedAttributes) {
            each(attribs, function(value, a) {
              result += " " + a + '="' + escapeHtml3(value || "", true) + '"';
            });
          } else if (!allowedAttributesMap || has(allowedAttributesMap, name) || allowedAttributesMap["*"]) {
            each(attribs, function(value, a) {
              if (!VALID_HTML_ATTRIBUTE_NAME.test(a)) {
                delete frame.attribs[a];
                return;
              }
              if (value === "" && !options.allowedEmptyAttributes.includes(a) && (options.nonBooleanAttributes.includes(a) || options.nonBooleanAttributes.includes("*"))) {
                delete frame.attribs[a];
                return;
              }
              let passedAllowedAttributesMapCheck = false;
              if (!allowedAttributesMap || has(allowedAttributesMap, name) && allowedAttributesMap[name].indexOf(a) !== -1 || allowedAttributesMap["*"] && allowedAttributesMap["*"].indexOf(a) !== -1 || has(allowedAttributesGlobMap, name) && allowedAttributesGlobMap[name].test(a) || allowedAttributesGlobMap["*"] && allowedAttributesGlobMap["*"].test(a)) {
                passedAllowedAttributesMapCheck = true;
              } else if (allowedAttributesMap && allowedAttributesMap[name]) {
                for (const o of allowedAttributesMap[name]) {
                  if (isPlainObject(o) && o.name && o.name === a) {
                    passedAllowedAttributesMapCheck = true;
                    let newValue = "";
                    if (o.multiple === true) {
                      const splitStrArray = value.split(" ");
                      for (const s of splitStrArray) {
                        if (o.values.indexOf(s) !== -1) {
                          if (newValue === "") {
                            newValue = s;
                          } else {
                            newValue += " " + s;
                          }
                        }
                      }
                    } else if (o.values.indexOf(value) >= 0) {
                      newValue = value;
                    }
                    value = newValue;
                  }
                }
              }
              if (passedAllowedAttributesMapCheck) {
                if (options.allowedSchemesAppliedToAttributes.indexOf(a) !== -1) {
                  if (naughtyHref(name, value)) {
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (name === "meta" && a.toLowerCase() === "content" && isRefresh(attribs) && naughtyRefresh(value)) {
                  delete frame.attribs[a];
                  return;
                }
                if (name === "script" && a === "src") {
                  let allowed = true;
                  try {
                    const parsed = parseUrl(value);
                    if (options.allowedScriptHostnames || options.allowedScriptDomains) {
                      const allowedHostname = (options.allowedScriptHostnames || []).find(function(hostname) {
                        return hostname === parsed.url.hostname;
                      });
                      const allowedDomain = (options.allowedScriptDomains || []).find(function(domain) {
                        return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                      });
                      allowed = allowedHostname || allowedDomain;
                    }
                  } catch (e) {
                    allowed = false;
                  }
                  if (!allowed) {
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (name === "iframe" && a === "src") {
                  let allowed = true;
                  try {
                    const parsed = parseUrl(value);
                    if (parsed.isRelativeUrl) {
                      allowed = has(options, "allowIframeRelativeUrls") ? options.allowIframeRelativeUrls : !options.allowedIframeHostnames && !options.allowedIframeDomains;
                    } else if (options.allowedIframeHostnames || options.allowedIframeDomains) {
                      const allowedHostname = (options.allowedIframeHostnames || []).find(function(hostname) {
                        return hostname === parsed.url.hostname;
                      });
                      const allowedDomain = (options.allowedIframeDomains || []).find(function(domain) {
                        return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                      });
                      allowed = allowedHostname || allowedDomain;
                    }
                  } catch (e) {
                    allowed = false;
                  }
                  if (!allowed) {
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (a === "srcset" || a === "imagesrcset") {
                  try {
                    let parsed = parseSrcset(value);
                    parsed.forEach(function(value2) {
                      if (naughtyHref(name, value2.url)) {
                        value2.evil = true;
                      }
                    });
                    parsed = filter2(parsed, function(v) {
                      return !v.evil;
                    });
                    if (!parsed.length) {
                      delete frame.attribs[a];
                      return;
                    } else {
                      value = stringifySrcset(filter2(parsed, function(v) {
                        return !v.evil;
                      }));
                      frame.attribs[a] = value;
                    }
                  } catch (e) {
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (a === "class") {
                  const allowedSpecificClasses = allowedClassesMap[name];
                  const allowedWildcardClasses = allowedClassesMap["*"];
                  const allowedSpecificClassesGlob = allowedClassesGlobMap[name];
                  const allowedSpecificClassesRegex = allowedClassesRegexMap[name];
                  const allowedWildcardClassesRegex = allowedClassesRegexMap["*"];
                  const allowedWildcardClassesGlob = allowedClassesGlobMap["*"];
                  const allowedClassesGlobs = [
                    allowedSpecificClassesGlob,
                    allowedWildcardClassesGlob
                  ].concat(allowedSpecificClassesRegex, allowedWildcardClassesRegex).filter(function(t) {
                    return t;
                  });
                  if (allowedSpecificClasses && allowedWildcardClasses) {
                    value = filterClasses(
                      value,
                      mergeClasses(allowedSpecificClasses, allowedWildcardClasses),
                      allowedClassesGlobs
                    );
                  } else {
                    value = filterClasses(
                      value,
                      allowedSpecificClasses || allowedWildcardClasses,
                      allowedClassesGlobs
                    );
                  }
                  if (!value.length) {
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (a === "style") {
                  if (options.parseStyleAttributes) {
                    try {
                      const abstractSyntaxTree = postcssParse(name + " {" + value + "}", { map: false });
                      const filteredAST = filterCss(
                        abstractSyntaxTree,
                        options.allowedStyles
                      );
                      value = stringifyStyleAttributes(filteredAST);
                      if (value.length === 0) {
                        delete frame.attribs[a];
                        return;
                      }
                    } catch (e) {
                      if (typeof window !== "undefined") {
                        logger.warn(
                          `Failed to parse "${name} {${value}}". If you are running this in a browser, we recommend disabling style parsing with the parseStyleAttributes option, since it only works in a node environment due to a postcss dependency. More info: https://github.com/apostrophecms/sanitize-html/issues/547`
                        );
                      }
                      delete frame.attribs[a];
                      return;
                    }
                  } else if (options.allowedStyles) {
                    throw new Error("allowedStyles option cannot be used together with parseStyleAttributes: false.");
                  }
                }
                result += " " + a;
                if (value && value.length) {
                  result += '="' + escapeHtml3(value, true) + '"';
                } else if (options.allowedEmptyAttributes.includes(a)) {
                  result += '=""';
                }
              } else {
                delete frame.attribs[a];
              }
            });
          }
          if (options.selfClosing.indexOf(name) !== -1) {
            result += " />";
          } else {
            result += ">";
            if (frame.innerText && !hasText) {
              const escaped = escapeHtml3(frame.innerText);
              if (options.textFilter) {
                result += options.textFilter(escaped, name);
              } else {
                result += escaped;
              }
              addedText = true;
            }
          }
          if (skip) {
            result = tempResult + escapeHtml3(result);
            tempResult = "";
          }
          frame.openingTagLength = result.length - frame.tagPosition;
        },
        ontext: function(text2) {
          updateRawTextRegion();
          if (skipText || skipRawText) {
            return;
          }
          const lastFrame = stack[stack.length - 1];
          let tag;
          if (lastFrame) {
            tag = lastFrame.tag;
            text2 = lastFrame.innerText !== void 0 ? lastFrame.innerText : text2;
          }
          if (options.disallowedTagsMode === "completelyDiscard" && !tagAllowed(tag)) {
            text2 = "";
          } else if (tag && tagAllowed(tag) && (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") && (tag === "script" || tag === "style")) {
            result += text2;
          } else if (tag && tagAllowed(tag) && (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") && (tag === "textarea" || tag === "xmp")) {
            if (tag === "xmp") {
              result += text2.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            } else {
              result += escapeHtml3(text2, false);
            }
          } else if (
            // htmlparser2 treats <iframe> as a raw-text element, so markup inside
            // (including after an unclosed <iframe>) arrives as a single text node.
            // When the iframe is discarded, re-sanitize that fallback markup as HTML
            // instead of escaping it as plain text (issue #5550).
            // The nested call continues from the current depth so that
            // `nestingLimit` applies to the whole output.
            tag === "iframe" && !tagAllowed(tag) && options.disallowedTagsMode === "discard" && iframeFallbackDepth < MAX_IFRAME_FALLBACK_DEPTH
          ) {
            result += sanitizeHtml2(text2, options, {
              depth,
              iframeFallbackDepth: iframeFallbackDepth + 1
            });
          } else if (!addedText) {
            const escaped = escapeHtml3(text2, false);
            if (options.textFilter) {
              result += options.textFilter(escaped, tag);
            } else {
              result += escaped;
            }
          }
          if (stack.length) {
            const frame = stack[stack.length - 1];
            frame.text += text2;
          }
        },
        onclosetag: function(name, isImplied) {
          if (options.onCloseTag) {
            options.onCloseTag(name, isImplied);
          }
          updateRawTextRegion();
          if (skipRawText) {
            const lastFrame = stack[stack.length - 1];
            if (!lastFrame || lastFrame.tag !== name) {
              return;
            }
          } else if (skipText) {
            skipTextDepth--;
            if (!skipTextDepth) {
              skipText = false;
              if (rawTextEnd !== null) {
                skipRawText = true;
              }
            } else {
              return;
            }
          }
          const frame = stack.pop();
          if (!frame) {
            return;
          }
          if (frame.tag !== name) {
            stack.push(frame);
            return;
          }
          skipText = options.enforceHtmlBoundary ? name === "html" : false;
          depth--;
          const skip = skipMap[depth];
          if (skip) {
            delete skipMap[depth];
            if (options.disallowedTagsMode === "discard" || options.disallowedTagsMode === "completelyDiscard") {
              frame.updateParentNodeText();
              return;
            }
            tempResult = result;
            result = "";
          }
          if (transformMap[depth]) {
            name = transformMap[depth];
            delete transformMap[depth];
          }
          if (options.exclusiveFilter) {
            const filterResult = options.exclusiveFilter(frame);
            if (filterResult === "excludeTag") {
              if (skip) {
                result = tempResult;
                tempResult = "";
              }
              result = result.substring(0, frame.tagPosition) + result.substring(frame.tagPosition + frame.openingTagLength);
              return;
            } else if (filterResult) {
              result = result.substring(0, frame.tagPosition);
              return;
            }
          }
          frame.updateParentNodeMediaChildren();
          frame.updateParentNodeText();
          if (
            // Already output />
            options.selfClosing.indexOf(name) !== -1 || // Escaped tag, closing tag is implied
            isImplied && !tagAllowed(name) && ["escape", "recursiveEscape"].indexOf(options.disallowedTagsMode) >= 0
          ) {
            if (skip) {
              result = tempResult;
              tempResult = "";
            }
            return;
          }
          result += "</" + name + ">";
          if (skip) {
            result = tempResult + escapeHtml3(result);
            tempResult = "";
          }
          addedText = false;
        }
      }, options.parser);
      parser2.write(html);
      parser2.end();
      if (options.disallowedTagsMode === "escape" || options.disallowedTagsMode === "recursiveEscape") {
        const lastParsedIndex = parser2.endIndex;
        if (lastParsedIndex != null && lastParsedIndex >= 0 && lastParsedIndex < html.length) {
          const unparsed = html.substring(lastParsedIndex);
          result += escapeHtml3(unparsed);
        } else if ((lastParsedIndex == null || lastParsedIndex < 0) && html.length > 0 && result === "") {
          result = escapeHtml3(html);
        }
      }
      return result;
      function initializeState() {
        result = "";
        depth = baseDepth;
        stack = [];
        skipMap = {};
        transformMap = {};
        skipText = false;
        skipTextDepth = 0;
        rawTextEnd = null;
        skipRawText = false;
      }
      function updateRawTextRegion() {
        if (rawTextEnd !== null && parser2.startIndex >= rawTextEnd) {
          rawTextEnd = null;
          skipRawText = false;
        }
      }
      function findRawTextEnd(tagName, from) {
        const re = new RegExp("</" + tagName + "[\\t\\n\\f\\r />]", "ig");
        re.lastIndex = from;
        const match = re.exec(html);
        return match ? match.index : Infinity;
      }
      function escapeHtml3(s, quote) {
        if (typeof s !== "string") {
          s = s + "";
        }
        if (options.parser.decodeEntities) {
          s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          if (quote) {
            s = s.replace(/"/g, "&quot;");
          }
        }
        s = s.replace(/&(?![a-zA-Z0-9#]{1,20};)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (quote) {
          s = s.replace(/"/g, "&quot;");
        }
        return s;
      }
      function naughtyHref(name, href) {
        const allowedSchemes = has(options.allowedSchemesByTag, name) ? options.allowedSchemesByTag[name] : options.allowedSchemes || [];
        return launderNaughtyHref(href, {
          allowedSchemes,
          allowProtocolRelative: options.allowProtocolRelative
        });
      }
      function isRefresh(attribs) {
        return Object.keys(attribs).some(function(a) {
          return a.toLowerCase() === "http-equiv" && String(attribs[a]).trim().toLowerCase() === "refresh";
        });
      }
      function naughtyRefresh(content) {
        const input = String(content);
        const isWhitespace2 = function(c) {
          return c === " " || c === "	" || c === "\n" || c === "\f" || c === "\r";
        };
        let position = 0;
        const skipWhitespace = function() {
          while (position < input.length && isWhitespace2(input[position])) {
            position++;
          }
        };
        const lowerAt = function(i) {
          return (input[i] || "").toLowerCase();
        };
        skipWhitespace();
        const timeStart = position;
        while (position < input.length && /[0-9.]/.test(input[position])) {
          position++;
        }
        if (position === timeStart) {
          return true;
        }
        if (position < input.length) {
          const c = input[position];
          if (c !== ";" && c !== "," && !isWhitespace2(c)) {
            return true;
          }
          skipWhitespace();
          if (input[position] === ";" || input[position] === ",") {
            position++;
          }
          skipWhitespace();
        }
        if (position >= input.length) {
          return false;
        }
        let url = input.slice(position);
        let quoted = true;
        if (lowerAt(position) === "u") {
          quoted = false;
          if (lowerAt(position + 1) === "r" && lowerAt(position + 2) === "l") {
            position += 3;
            skipWhitespace();
            if (input[position] === "=") {
              position++;
              skipWhitespace();
              quoted = true;
            }
          }
        }
        if (quoted) {
          const quote = input[position];
          if (quote === '"' || quote === "'") {
            position++;
          }
          url = input.slice(position);
          if (quote === '"' || quote === "'") {
            const end = url.indexOf(quote);
            if (end !== -1) {
              url = url.slice(0, end);
            }
          }
        }
        return naughtyHref("meta", url);
      }
      function animatesUrlAttribute(name, attribs) {
        if (svgAnimationTags.indexOf(localPart(name)) === -1) {
          return false;
        }
        const schemeCheckedAttributes = options.allowedSchemesAppliedToAttributes || [];
        return Object.keys(attribs || {}).some(function(attributeName) {
          if (localPart(attributeName) !== "attributename") {
            return false;
          }
          const target = (attribs[attributeName] || "").trim().toLowerCase();
          const localName = target.slice(target.lastIndexOf(":") + 1);
          return alwaysUrlAttributes.indexOf(localName) !== -1 || schemeCheckedAttributes.indexOf(target) !== -1 || schemeCheckedAttributes.indexOf(localName) !== -1;
        });
      }
      function localPart(name) {
        const lower = name.toLowerCase();
        return lower.slice(lower.lastIndexOf(":") + 1);
      }
      function parseUrl(value) {
        value = value.replace(/^(\w+:)?\s*[\\/]\s*[\\/]/, "$1//");
        if (value.startsWith("relative:")) {
          throw new Error("relative: exploit attempt");
        }
        let base2 = "relative://relative-site";
        for (let i = 0; i < 100; i++) {
          base2 += `/${i}`;
        }
        const parsed = new URL(value, base2);
        const isRelativeUrl = parsed && parsed.hostname === "relative-site" && parsed.protocol === "relative:";
        return {
          isRelativeUrl,
          url: parsed
        };
      }
      function filterCss(abstractSyntaxTree, allowedStyles) {
        if (!allowedStyles) {
          return abstractSyntaxTree;
        }
        const astRules = abstractSyntaxTree.nodes[0];
        let selectedRule;
        if (allowedStyles[astRules.selector] && allowedStyles["*"]) {
          selectedRule = mergeStyles(
            allowedStyles[astRules.selector],
            allowedStyles["*"]
          );
        } else {
          selectedRule = allowedStyles[astRules.selector] || allowedStyles["*"];
        }
        if (selectedRule) {
          abstractSyntaxTree.nodes[0].nodes = astRules.nodes.reduce(filterDeclarations(selectedRule), []);
        }
        return abstractSyntaxTree;
      }
      function stringifyStyleAttributes(filteredAST) {
        return filteredAST.nodes[0].nodes.reduce(function(extractedAttributes, attrObject) {
          extractedAttributes.push(
            `${attrObject.prop}:${attrObject.value}${attrObject.important ? " !important" : ""}`
          );
          return extractedAttributes;
        }, []).join(";");
      }
      function filterDeclarations(selectedRule) {
        return function(allowedDeclarationsList, attributeObject) {
          if (has(selectedRule, attributeObject.prop)) {
            const matchesRegex = selectedRule[attributeObject.prop].some(function(regularExpression) {
              return regularExpression.test(attributeObject.value);
            });
            if (matchesRegex) {
              allowedDeclarationsList.push(attributeObject);
            }
          }
          return allowedDeclarationsList;
        };
      }
      function filterClasses(classes, allowed, allowedGlobs) {
        if (!allowed) {
          return classes;
        }
        classes = classes.split(/\s+/);
        return classes.filter(function(clss) {
          return allowed.indexOf(clss) !== -1 || allowedGlobs.some(function(glob) {
            return glob.test(clss);
          });
        }).join(" ");
      }
    }
    var htmlParserDefaults = {
      decodeEntities: true
    };
    sanitizeHtml2.defaults = {
      allowedTags: [
        // Sections derived from MDN element categories and limited to the more
        // benign categories.
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element
        // Content sectioning
        "address",
        "article",
        "aside",
        "footer",
        "header",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hgroup",
        "main",
        "nav",
        "section",
        // Text content
        "blockquote",
        "dd",
        "div",
        "dl",
        "dt",
        "figcaption",
        "figure",
        "hr",
        "li",
        "menu",
        "ol",
        "p",
        "pre",
        "ul",
        // Inline text semantics
        "a",
        "abbr",
        "b",
        "bdi",
        "bdo",
        "br",
        "cite",
        "code",
        "data",
        "dfn",
        "em",
        "i",
        "kbd",
        "mark",
        "q",
        "rb",
        "rp",
        "rt",
        "rtc",
        "ruby",
        "s",
        "samp",
        "small",
        "span",
        "strong",
        "sub",
        "sup",
        "time",
        "u",
        "var",
        "wbr",
        // Table content
        "caption",
        "col",
        "colgroup",
        "table",
        "tbody",
        "td",
        "tfoot",
        "th",
        "thead",
        "tr"
      ],
      // Tags that cannot be boolean
      nonBooleanAttributes: [
        "abbr",
        "accept",
        "accept-charset",
        "accesskey",
        "action",
        "allow",
        "alt",
        "as",
        "autocapitalize",
        "autocomplete",
        "blocking",
        "charset",
        "cite",
        "class",
        "color",
        "cols",
        "colspan",
        "content",
        "contenteditable",
        "coords",
        "crossorigin",
        "data",
        "datetime",
        "decoding",
        "dir",
        "dirname",
        "download",
        "draggable",
        "enctype",
        "enterkeyhint",
        "fetchpriority",
        "for",
        "form",
        "formaction",
        "formenctype",
        "formmethod",
        "formtarget",
        "headers",
        "height",
        "hidden",
        "high",
        "href",
        "hreflang",
        "http-equiv",
        "id",
        "imagesizes",
        "imagesrcset",
        "inputmode",
        "integrity",
        "is",
        "itemid",
        "itemprop",
        "itemref",
        "itemtype",
        "kind",
        "label",
        "lang",
        "list",
        "loading",
        "low",
        "max",
        "maxlength",
        "media",
        "method",
        "min",
        "minlength",
        "name",
        "nonce",
        "optimum",
        "pattern",
        "ping",
        "placeholder",
        "popover",
        "popovertarget",
        "popovertargetaction",
        "poster",
        "preload",
        "referrerpolicy",
        "rel",
        "rows",
        "rowspan",
        "sandbox",
        "scope",
        "shape",
        "size",
        "sizes",
        "slot",
        "span",
        "spellcheck",
        "src",
        "srcdoc",
        "srclang",
        "srcset",
        "start",
        "step",
        "style",
        "tabindex",
        "target",
        "title",
        "translate",
        "type",
        "usemap",
        "value",
        "width",
        "wrap",
        // Event handlers
        "onauxclick",
        "onafterprint",
        "onbeforematch",
        "onbeforeprint",
        "onbeforeunload",
        "onbeforetoggle",
        "onblur",
        "oncancel",
        "oncanplay",
        "oncanplaythrough",
        "onchange",
        "onclick",
        "onclose",
        "oncontextlost",
        "oncontextmenu",
        "oncontextrestored",
        "oncopy",
        "oncuechange",
        "oncut",
        "ondblclick",
        "ondrag",
        "ondragend",
        "ondragenter",
        "ondragleave",
        "ondragover",
        "ondragstart",
        "ondrop",
        "ondurationchange",
        "onemptied",
        "onended",
        "onerror",
        "onfocus",
        "onformdata",
        "onhashchange",
        "oninput",
        "oninvalid",
        "onkeydown",
        "onkeypress",
        "onkeyup",
        "onlanguagechange",
        "onload",
        "onloadeddata",
        "onloadedmetadata",
        "onloadstart",
        "onmessage",
        "onmessageerror",
        "onmousedown",
        "onmouseenter",
        "onmouseleave",
        "onmousemove",
        "onmouseout",
        "onmouseover",
        "onmouseup",
        "onoffline",
        "ononline",
        "onpagehide",
        "onpageshow",
        "onpaste",
        "onpause",
        "onplay",
        "onplaying",
        "onpopstate",
        "onprogress",
        "onratechange",
        "onreset",
        "onresize",
        "onrejectionhandled",
        "onscroll",
        "onscrollend",
        "onsecuritypolicyviolation",
        "onseeked",
        "onseeking",
        "onselect",
        "onslotchange",
        "onstalled",
        "onstorage",
        "onsubmit",
        "onsuspend",
        "ontimeupdate",
        "ontoggle",
        "onunhandledrejection",
        "onunload",
        "onvolumechange",
        "onwaiting",
        "onwheel"
      ],
      disallowedTagsMode: "discard",
      allowedAttributes: {
        a: ["href", "name", "target"],
        // We don't currently allow img itself by default, but
        // these attributes would make sense if we did.
        img: ["src", "srcset", "alt", "title", "width", "height", "loading"]
      },
      allowedEmptyAttributes: [
        "alt"
      ],
      // Lots of these won't come up by default because we don't allow them
      selfClosing: ["img", "br", "hr", "area", "base", "basefont", "input", "link", "meta", "col"],
      // URL schemes we permit
      allowedSchemes: ["http", "https", "ftp", "mailto", "tel"],
      allowedSchemesByTag: {},
      allowedSchemesAppliedToAttributes: [
        "href",
        "src",
        "cite",
        "action",
        "formaction",
        "data",
        "xlink:href",
        "poster",
        "background",
        "ping",
        "longdesc",
        "usemap",
        "codebase",
        "classid",
        "archive",
        "profile",
        "manifest",
        "itemid",
        "dynsrc",
        "lowsrc"
      ],
      allowProtocolRelative: true,
      enforceHtmlBoundary: false,
      parseStyleAttributes: true,
      preserveEscapedAttributes: false
    };
    sanitizeHtml2.simpleTransform = function(newTagName, newAttribs, merge2) {
      merge2 = merge2 === void 0 ? true : merge2;
      newAttribs = newAttribs || {};
      return function(tagName, attribs) {
        let attrib;
        if (merge2) {
          for (attrib in newAttribs) {
            attribs[attrib] = newAttribs[attrib];
          }
        } else {
          attribs = newAttribs;
        }
        return {
          tagName: newTagName,
          attribs
        };
      };
    };
  }
});

// node_modules/yaml/browser/dist/nodes/identity.js
var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
function isCollection(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case MAP:
      case SEQ:
        return true;
    }
  return false;
}
function isNode(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case ALIAS:
      case MAP:
      case SCALAR:
      case SEQ:
        return true;
    }
  return false;
}
var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

// node_modules/yaml/browser/dist/visit.js
var BREAK = /* @__PURE__ */ Symbol("break visit");
var SKIP = /* @__PURE__ */ Symbol("skip children");
var REMOVE = /* @__PURE__ */ Symbol("remove node");
function visit(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    visit_(null, node, visitor_, Object.freeze([]));
}
visit.BREAK = BREAK;
visit.SKIP = SKIP;
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path) {
  const ctrl = callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visit_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = visit_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = visit_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = visit_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
async function visitAsync(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    await visitAsync_(null, node, visitor_, Object.freeze([]));
}
visitAsync.BREAK = BREAK;
visitAsync.SKIP = SKIP;
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path) {
  const ctrl = await callVisitor(key, node, visitor, path);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path, ctrl);
    return visitAsync_(key, ctrl, visitor, path);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path = Object.freeze(path.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = await visitAsync_(i, node.items[i], visitor, path);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path = Object.freeze(path.concat(node));
      const ck = await visitAsync_("key", node.key, visitor, path);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = await visitAsync_("value", node.value, visitor, path);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
function initVisitor(visitor) {
  if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
    return Object.assign({
      Alias: visitor.Node,
      Map: visitor.Node,
      Scalar: visitor.Node,
      Seq: visitor.Node
    }, visitor.Value && {
      Map: visitor.Value,
      Scalar: visitor.Value,
      Seq: visitor.Value
    }, visitor.Collection && {
      Map: visitor.Collection,
      Seq: visitor.Collection
    }, visitor);
  }
  return visitor;
}
function callVisitor(key, node, visitor, path) {
  if (typeof visitor === "function")
    return visitor(key, node, path);
  if (isMap(node))
    return visitor.Map?.(key, node, path);
  if (isSeq(node))
    return visitor.Seq?.(key, node, path);
  if (isPair(node))
    return visitor.Pair?.(key, node, path);
  if (isScalar(node))
    return visitor.Scalar?.(key, node, path);
  if (isAlias(node))
    return visitor.Alias?.(key, node, path);
  return void 0;
}
function replaceNode(key, path, node) {
  const parent = path[path.length - 1];
  if (isCollection(parent)) {
    parent.items[key] = node;
  } else if (isPair(parent)) {
    if (key === "key")
      parent.key = node;
    else
      parent.value = node;
  } else if (isDocument(parent)) {
    parent.contents = node;
  } else {
    const pt = isAlias(parent) ? "alias" : "scalar";
    throw new Error(`Cannot replace node with ${pt} parent`);
  }
}

// node_modules/yaml/browser/dist/doc/directives.js
var escapeChars = {
  "!": "%21",
  ",": "%2C",
  "[": "%5B",
  "]": "%5D",
  "{": "%7B",
  "}": "%7D"
};
var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
var Directives = class _Directives {
  constructor(yaml, tags) {
    this.docStart = null;
    this.docEnd = false;
    this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
    this.tags = Object.assign({}, _Directives.defaultTags, tags);
  }
  clone() {
    const copy = new _Directives(this.yaml, this.tags);
    copy.docStart = this.docStart;
    return copy;
  }
  /**
   * During parsing, get a Directives instance for the current document and
   * update the stream state according to the current version's spec.
   */
  atDocument() {
    const res = new _Directives(this.yaml, this.tags);
    switch (this.yaml.version) {
      case "1.1":
        this.atNextDocument = true;
        break;
      case "1.2":
        this.atNextDocument = false;
        this.yaml = {
          explicit: _Directives.defaultYaml.explicit,
          version: "1.2"
        };
        this.tags = Object.assign({}, _Directives.defaultTags);
        break;
    }
    return res;
  }
  /**
   * @param onError - May be called even if the action was successful
   * @returns `true` on success
   */
  add(line, onError) {
    if (this.atNextDocument) {
      this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
      this.tags = Object.assign({}, _Directives.defaultTags);
      this.atNextDocument = false;
    }
    const parts = line.trim().split(/[ \t]+/);
    const name = parts.shift();
    switch (name) {
      case "%TAG": {
        if (parts.length !== 2) {
          onError(0, "%TAG directive should contain exactly two parts");
          if (parts.length < 2)
            return false;
        }
        const [handle, prefix] = parts;
        this.tags[handle] = prefix;
        return true;
      }
      case "%YAML": {
        this.yaml.explicit = true;
        if (parts.length !== 1) {
          onError(0, "%YAML directive should contain exactly one part");
          return false;
        }
        const [version] = parts;
        if (version === "1.1" || version === "1.2") {
          this.yaml.version = version;
          return true;
        } else {
          const isValid = /^\d+\.\d+$/.test(version);
          onError(6, `Unsupported YAML version ${version}`, isValid);
          return false;
        }
      }
      default:
        onError(0, `Unknown directive ${name}`, true);
        return false;
    }
  }
  /**
   * Resolves a tag, matching handles to those defined in %TAG directives.
   *
   * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
   *   `'!local'` tag, or `null` if unresolvable.
   */
  tagName(source, onError) {
    if (source === "!")
      return "!";
    if (source[0] !== "!") {
      onError(`Not a valid tag: ${source}`);
      return null;
    }
    if (source[1] === "<") {
      const verbatim = source.slice(2, -1);
      if (verbatim === "!" || verbatim === "!!") {
        onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
        return null;
      }
      if (source[source.length - 1] !== ">")
        onError("Verbatim tags must end with a >");
      return verbatim;
    }
    const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
    if (!suffix)
      onError(`The ${source} tag has no suffix`);
    const prefix = this.tags[handle];
    if (prefix) {
      try {
        return prefix + decodeURIComponent(suffix);
      } catch (error2) {
        onError(String(error2));
        return null;
      }
    }
    if (handle === "!")
      return source;
    onError(`Could not resolve tag: ${source}`);
    return null;
  }
  /**
   * Given a fully resolved tag, returns its printable string form,
   * taking into account current tag prefixes and defaults.
   */
  tagString(tag) {
    for (const [handle, prefix] of Object.entries(this.tags)) {
      if (tag.startsWith(prefix))
        return handle + escapeTagName(tag.substring(prefix.length));
    }
    return tag[0] === "!" ? tag : `!<${tag}>`;
  }
  toString(doc) {
    const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
    const tagEntries = Object.entries(this.tags);
    let tagNames;
    if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
      const tags = {};
      visit(doc.contents, (_key, node) => {
        if (isNode(node) && node.tag)
          tags[node.tag] = true;
      });
      tagNames = Object.keys(tags);
    } else
      tagNames = [];
    for (const [handle, prefix] of tagEntries) {
      if (handle === "!!" && prefix === "tag:yaml.org,2002:")
        continue;
      if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
        lines.push(`%TAG ${handle} ${prefix}`);
    }
    return lines.join("\n");
  }
};
Directives.defaultYaml = { explicit: false, version: "1.2" };
Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

// node_modules/yaml/browser/dist/doc/anchors.js
function anchorIsValid(anchor) {
  if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
    const sa = JSON.stringify(anchor);
    const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
    throw new Error(msg);
  }
  return true;
}
function anchorNames(root) {
  const anchors = /* @__PURE__ */ new Set();
  visit(root, {
    Value(_key, node) {
      if (node.anchor)
        anchors.add(node.anchor);
    }
  });
  return anchors;
}
function findNewAnchor(prefix, exclude) {
  for (let i = 1; true; ++i) {
    const name = `${prefix}${i}`;
    if (!exclude.has(name))
      return name;
  }
}
function createNodeAnchors(doc, prefix) {
  const aliasObjects = [];
  const sourceObjects = /* @__PURE__ */ new Map();
  let prevAnchors = null;
  return {
    onAnchor: (source) => {
      aliasObjects.push(source);
      prevAnchors ?? (prevAnchors = anchorNames(doc));
      const anchor = findNewAnchor(prefix, prevAnchors);
      prevAnchors.add(anchor);
      return anchor;
    },
    /**
     * With circular references, the source node is only resolved after all
     * of its child nodes are. This is why anchors are set only after all of
     * the nodes have been created.
     */
    setAnchors: () => {
      for (const source of aliasObjects) {
        const ref = sourceObjects.get(source);
        if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
          ref.node.anchor = ref.anchor;
        } else {
          const error2 = new Error("Failed to resolve repeated object (this should not happen)");
          error2.source = source;
          throw error2;
        }
      }
    },
    sourceObjects
  };
}

// node_modules/yaml/browser/dist/doc/applyReviver.js
function applyReviver(reviver, obj, key, val) {
  if (val && typeof val === "object") {
    if (Array.isArray(val)) {
      for (let i = 0, len = val.length; i < len; ++i) {
        const v0 = val[i];
        const v1 = applyReviver(reviver, val, String(i), v0);
        if (v1 === void 0)
          delete val[i];
        else if (v1 !== v0)
          val[i] = v1;
      }
    } else if (val instanceof Map) {
      for (const k of Array.from(val.keys())) {
        const v0 = val.get(k);
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          val.delete(k);
        else if (v1 !== v0)
          val.set(k, v1);
      }
    } else if (val instanceof Set) {
      for (const v0 of Array.from(val)) {
        const v1 = applyReviver(reviver, val, v0, v0);
        if (v1 === void 0)
          val.delete(v0);
        else if (v1 !== v0) {
          val.delete(v0);
          val.add(v1);
        }
      }
    } else {
      for (const [k, v0] of Object.entries(val)) {
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          delete val[k];
        else if (v1 !== v0)
          val[k] = v1;
      }
    }
  }
  return reviver.call(obj, key, val);
}

// node_modules/yaml/browser/dist/nodes/toJS.js
function toJS(value, arg, ctx) {
  if (Array.isArray(value))
    return value.map((v, i) => toJS(v, String(i), ctx));
  if (value && typeof value.toJSON === "function") {
    if (!ctx || !hasAnchor(value))
      return value.toJSON(arg, ctx);
    const data = { aliasCount: 0, count: 1, res: void 0 };
    ctx.anchors.set(value, data);
    ctx.onCreate = (res2) => {
      data.res = res2;
      delete ctx.onCreate;
    };
    const res = value.toJSON(arg, ctx);
    if (ctx.onCreate)
      ctx.onCreate(res);
    return res;
  }
  if (typeof value === "bigint" && !ctx?.keep)
    return Number(value);
  return value;
}

// node_modules/yaml/browser/dist/nodes/Node.js
var NodeBase = class {
  constructor(type) {
    Object.defineProperty(this, NODE_TYPE, { value: type });
  }
  /** Create a copy of this node.  */
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** A plain JavaScript representation of this node. */
  toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    if (!isDocument(doc))
      throw new TypeError("A document argument is required");
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc,
      keep: true,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this, "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
};

// node_modules/yaml/browser/dist/nodes/Alias.js
var Alias = class extends NodeBase {
  constructor(source) {
    super(ALIAS);
    this.source = source;
    Object.defineProperty(this, "tag", {
      set() {
        throw new Error("Alias nodes cannot have tags");
      }
    });
  }
  /**
   * Resolve the value of this alias within `doc`, finding the last
   * instance of the `source` anchor before this node.
   */
  resolve(doc, ctx) {
    if (ctx?.maxAliasCount === 0)
      throw new ReferenceError("Alias resolution is disabled");
    let nodes;
    if (ctx?.aliasResolveCache) {
      nodes = ctx.aliasResolveCache;
    } else {
      nodes = [];
      visit(doc, {
        Node: (_key, node) => {
          if (isAlias(node) || hasAnchor(node))
            nodes.push(node);
        }
      });
      if (ctx)
        ctx.aliasResolveCache = nodes;
    }
    let found = void 0;
    for (const node of nodes) {
      if (node === this)
        break;
      if (node.anchor === this.source)
        found = node;
    }
    if (found && ctx) {
      const { anchors, doc: doc2, maxAliasCount } = ctx;
      let data = anchors.get(found);
      if (!data) {
        toJS(found, null, ctx);
        data = anchors.get(found);
      }
      if (data?.res === void 0) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data.count += 1;
        if (data.aliasCount === 0)
          data.aliasCount = getAliasCount(doc2, found, anchors);
        if (data.count * data.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
    }
    return found;
  }
  toJSON(_arg, ctx) {
    if (!ctx)
      return { source: this.source };
    const source = this.resolve(ctx.doc, ctx);
    if (!source) {
      const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
      throw new ReferenceError(msg);
    }
    return ctx.anchors.get(source).res;
  }
  toString(ctx, _onComment, _onChompKeep) {
    const src = `*${this.source}`;
    if (ctx) {
      anchorIsValid(this.source);
      if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new Error(msg);
      }
      if (ctx.implicitKey)
        return `${src} `;
    }
    return src;
  }
};
function getAliasCount(doc, node, anchors) {
  if (isAlias(node)) {
    const source = node.resolve(doc);
    const anchor = anchors && source && anchors.get(source);
    return anchor ? anchor.count * anchor.aliasCount : 0;
  } else if (isCollection(node)) {
    let count = 0;
    for (const item of node.items) {
      const c = getAliasCount(doc, item, anchors);
      if (c > count)
        count = c;
    }
    return count;
  } else if (isPair(node)) {
    const kc = getAliasCount(doc, node.key, anchors);
    const vc = getAliasCount(doc, node.value, anchors);
    return Math.max(kc, vc);
  }
  return 1;
}

// node_modules/yaml/browser/dist/nodes/Scalar.js
var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
var Scalar = class extends NodeBase {
  constructor(value) {
    super(SCALAR);
    this.value = value;
  }
  toJSON(arg, ctx) {
    return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
  }
  toString() {
    return String(this.value);
  }
};
Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
Scalar.PLAIN = "PLAIN";
Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

// node_modules/yaml/browser/dist/doc/createNode.js
var defaultTagPrefix = "tag:yaml.org,2002:";
function findTagObject(value, tagName, tags) {
  if (tagName) {
    const match = tags.filter((t) => t.tag === tagName);
    const tagObj = match.find((t) => !t.format) ?? match[0];
    if (!tagObj)
      throw new Error(`Tag ${tagName} not found`);
    return tagObj;
  }
  return tags.find((t) => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
  if (isDocument(value))
    value = value.contents;
  if (isNode(value))
    return value;
  if (isPair(value)) {
    const map3 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
    map3.items.push(value);
    return map3;
  }
  if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
    value = value.valueOf();
  }
  const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
  let ref = void 0;
  if (aliasDuplicateObjects && value && typeof value === "object") {
    ref = sourceObjects.get(value);
    if (ref) {
      ref.anchor ?? (ref.anchor = onAnchor(value));
      return new Alias(ref.anchor);
    } else {
      ref = { anchor: null, node: null };
      sourceObjects.set(value, ref);
    }
  }
  if (tagName?.startsWith("!!"))
    tagName = defaultTagPrefix + tagName.slice(2);
  let tagObj = findTagObject(value, tagName, schema4.tags);
  if (!tagObj) {
    if (value && typeof value.toJSON === "function") {
      value = value.toJSON();
    }
    if (!value || typeof value !== "object") {
      const node2 = new Scalar(value);
      if (ref)
        ref.node = node2;
      return node2;
    }
    tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
  }
  if (onTagObj) {
    onTagObj(tagObj);
    delete ctx.onTagObj;
  }
  const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
  if (tagName)
    node.tag = tagName;
  else if (!tagObj.default)
    node.tag = tagObj.tag;
  if (ref)
    ref.node = node;
  return node;
}

// node_modules/yaml/browser/dist/nodes/Collection.js
function collectionFromPath(schema4, path, value) {
  let v = value;
  for (let i = path.length - 1; i >= 0; --i) {
    const k = path[i];
    if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
      const a = [];
      a[k] = v;
      v = a;
    } else {
      v = /* @__PURE__ */ new Map([[k, v]]);
    }
  }
  return createNode(v, void 0, {
    aliasDuplicateObjects: false,
    keepUndefined: false,
    onAnchor: () => {
      throw new Error("This should not happen, please report a bug.");
    },
    schema: schema4,
    sourceObjects: /* @__PURE__ */ new Map()
  });
}
var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
var Collection = class extends NodeBase {
  constructor(type, schema4) {
    super(type);
    Object.defineProperty(this, "schema", {
      value: schema4,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  /**
   * Create a copy of this collection.
   *
   * @param schema - If defined, overwrites the original's schema
   */
  clone(schema4) {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (schema4)
      copy.schema = schema4;
    copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /**
   * Adds a value to the collection. For `!!map` and `!!omap` the value must
   * be a Pair instance or a `{ key, value }` object, which may not have a key
   * that already exists in the map.
   */
  addIn(path, value) {
    if (isEmptyPath(path))
      this.add(value);
    else {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (isCollection(node))
        node.addIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
  /**
   * Removes a value from the collection.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.delete(key);
    const node = this.get(key, true);
    if (isCollection(node))
      return node.deleteIn(rest);
    else
      throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    const [key, ...rest] = path;
    const node = this.get(key, true);
    if (rest.length === 0)
      return !keepScalar && isScalar(node) ? node.value : node;
    else
      return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
  }
  hasAllNullValues(allowScalar) {
    return this.items.every((node) => {
      if (!isPair(node))
        return false;
      const n = node.value;
      return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
    });
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   */
  hasIn(path) {
    const [key, ...rest] = path;
    if (rest.length === 0)
      return this.has(key);
    const node = this.get(key, true);
    return isCollection(node) ? node.hasIn(rest) : false;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    const [key, ...rest] = path;
    if (rest.length === 0) {
      this.set(key, value);
    } else {
      const node = this.get(key, true);
      if (isCollection(node))
        node.setIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyComment.js
var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
function indentComment(comment, indent) {
  if (/^\n+$/.test(comment))
    return comment.substring(1);
  return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

// node_modules/yaml/browser/dist/stringify/foldFlowLines.js
var FOLD_FLOW = "flow";
var FOLD_BLOCK = "block";
var FOLD_QUOTED = "quoted";
function foldFlowLines(text2, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
  if (!lineWidth || lineWidth < 0)
    return text2;
  if (lineWidth < minContentWidth)
    minContentWidth = 0;
  const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
  if (text2.length <= endStep)
    return text2;
  const folds = [];
  const escapedFolds = {};
  let end = lineWidth - indent.length;
  if (typeof indentAtStart === "number") {
    if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
      folds.push(0);
    else
      end = lineWidth - indentAtStart;
  }
  let split = void 0;
  let prev = void 0;
  let overflow = false;
  let i = -1;
  let escStart = -1;
  let escEnd = -1;
  if (mode === FOLD_BLOCK) {
    i = consumeMoreIndentedLines(text2, i, indent.length);
    if (i !== -1)
      end = i + endStep;
  }
  for (let ch; ch = text2[i += 1]; ) {
    if (mode === FOLD_QUOTED && ch === "\\") {
      escStart = i;
      switch (text2[i + 1]) {
        case "x":
          i += 3;
          break;
        case "u":
          i += 5;
          break;
        case "U":
          i += 9;
          break;
        default:
          i += 1;
      }
      escEnd = i;
    }
    if (ch === "\n") {
      if (mode === FOLD_BLOCK)
        i = consumeMoreIndentedLines(text2, i, indent.length);
      end = i + indent.length + endStep;
      split = void 0;
    } else {
      if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
        const next = text2[i + 1];
        if (next && next !== " " && next !== "\n" && next !== "	")
          split = i;
      }
      if (i >= end) {
        if (split) {
          folds.push(split);
          end = split + endStep;
          split = void 0;
        } else if (mode === FOLD_QUOTED) {
          while (prev === " " || prev === "	") {
            prev = ch;
            ch = text2[i += 1];
            overflow = true;
          }
          const j = i > escEnd + 1 ? i - 2 : escStart - 1;
          if (escapedFolds[j])
            return text2;
          folds.push(j);
          escapedFolds[j] = true;
          end = j + endStep;
          split = void 0;
        } else {
          overflow = true;
        }
      }
    }
    prev = ch;
  }
  if (overflow && onOverflow)
    onOverflow();
  if (folds.length === 0)
    return text2;
  if (onFold)
    onFold();
  let res = text2.slice(0, folds[0]);
  for (let i2 = 0; i2 < folds.length; ++i2) {
    const fold = folds[i2];
    const end2 = folds[i2 + 1] || text2.length;
    if (fold === 0)
      res = `
${indent}${text2.slice(0, end2)}`;
    else {
      if (mode === FOLD_QUOTED && escapedFolds[fold])
        res += `${text2[fold]}\\`;
      res += `
${indent}${text2.slice(fold + 1, end2)}`;
    }
  }
  return res;
}
function consumeMoreIndentedLines(text2, i, indent) {
  let end = i;
  let start = i + 1;
  let ch = text2[start];
  while (ch === " " || ch === "	") {
    if (i < start + indent) {
      ch = text2[++i];
    } else {
      do {
        ch = text2[++i];
      } while (ch && ch !== "\n");
      end = i;
      start = i + 1;
      ch = text2[start];
    }
  }
  return end;
}

// node_modules/yaml/browser/dist/stringify/stringifyString.js
var getFoldOptions = (ctx, isBlock2) => ({
  indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
  lineWidth: ctx.options.lineWidth,
  minContentWidth: ctx.options.minContentWidth
});
var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
  if (!lineWidth || lineWidth < 0)
    return false;
  const limit = lineWidth - indentLength;
  const strLen = str.length;
  if (strLen <= limit)
    return false;
  for (let i = 0, start = 0; i < strLen; ++i) {
    if (str[i] === "\n") {
      if (i - start > limit)
        return true;
      start = i + 1;
      if (strLen - start <= limit)
        return false;
    }
  }
  return true;
}
function doubleQuotedString(value, ctx) {
  const json = JSON.stringify(value);
  if (ctx.options.doubleQuotedAsJSON)
    return json;
  const { implicitKey } = ctx;
  const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  let str = "";
  let start = 0;
  for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
    if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
      str += json.slice(start, i) + "\\ ";
      i += 1;
      start = i;
      ch = "\\";
    }
    if (ch === "\\")
      switch (json[i + 1]) {
        case "u":
          {
            str += json.slice(start, i);
            const code2 = json.substr(i + 2, 4);
            switch (code2) {
              case "0000":
                str += "\\0";
                break;
              case "0007":
                str += "\\a";
                break;
              case "000b":
                str += "\\v";
                break;
              case "001b":
                str += "\\e";
                break;
              case "0085":
                str += "\\N";
                break;
              case "00a0":
                str += "\\_";
                break;
              case "2028":
                str += "\\L";
                break;
              case "2029":
                str += "\\P";
                break;
              default:
                if (code2.substr(0, 2) === "00")
                  str += "\\x" + code2.substr(2);
                else
                  str += json.substr(i, 6);
            }
            i += 5;
            start = i + 1;
          }
          break;
        case "n":
          if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
            i += 1;
          } else {
            str += json.slice(start, i) + "\n\n";
            while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
              str += "\n";
              i += 2;
            }
            str += indent;
            if (json[i + 2] === " ")
              str += "\\";
            i += 1;
            start = i + 1;
          }
          break;
        default:
          i += 1;
      }
  }
  str = start ? str + json.slice(start) : json;
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
  if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
    return doubleQuotedString(value, ctx);
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
  return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
  const { singleQuote } = ctx.options;
  let qs;
  if (singleQuote === false)
    qs = doubleQuotedString;
  else {
    const hasDouble = value.includes('"');
    const hasSingle = value.includes("'");
    if (hasDouble && !hasSingle)
      qs = singleQuotedString;
    else if (hasSingle && !hasDouble)
      qs = doubleQuotedString;
    else
      qs = singleQuote ? singleQuotedString : doubleQuotedString;
  }
  return qs(value, ctx);
}
var blockEndNewlines;
try {
  blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
} catch {
  blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
  const { blockQuote, commentString, lineWidth } = ctx.options;
  if (!blockQuote || /\n[\t ]+$/.test(value)) {
    return quotedString(value, ctx);
  }
  const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
  const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
  if (!value)
    return literal ? "|\n" : ">\n";
  let chomp;
  let endStart;
  for (endStart = value.length; endStart > 0; --endStart) {
    const ch = value[endStart - 1];
    if (ch !== "\n" && ch !== "	" && ch !== " ")
      break;
  }
  let end = value.substring(endStart);
  const endNlPos = end.indexOf("\n");
  if (endNlPos === -1) {
    chomp = "-";
  } else if (value === end || endNlPos !== end.length - 1) {
    chomp = "+";
    if (onChompKeep)
      onChompKeep();
  } else {
    chomp = "";
  }
  if (end) {
    value = value.slice(0, -end.length);
    if (end[end.length - 1] === "\n")
      end = end.slice(0, -1);
    end = end.replace(blockEndNewlines, `$&${indent}`);
  }
  let startWithSpace = false;
  let startEnd;
  let startNlPos = -1;
  for (startEnd = 0; startEnd < value.length; ++startEnd) {
    const ch = value[startEnd];
    if (ch === " ")
      startWithSpace = true;
    else if (ch === "\n")
      startNlPos = startEnd;
    else
      break;
  }
  let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
  if (start) {
    value = value.substring(start.length);
    start = start.replace(/\n+/g, `$&${indent}`);
  }
  const indentSize = indent ? "2" : "1";
  let header = (startWithSpace ? indentSize : "") + chomp;
  if (comment) {
    header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
    if (onComment)
      onComment();
  }
  if (!literal) {
    const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
    let literalFallback = false;
    const foldOptions = getFoldOptions(ctx, true);
    if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
      foldOptions.onOverflow = () => {
        literalFallback = true;
      };
    }
    const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
    if (!literalFallback)
      return `>${header}
${indent}${body}`;
  }
  value = value.replace(/\n+/g, `$&${indent}`);
  return `|${header}
${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
  const { type, value } = item;
  const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
  if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
    return quotedString(value, ctx);
  }
  if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
    return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
  }
  if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
    return blockString(item, ctx, onComment, onChompKeep);
  }
  if (containsDocumentMarker(value)) {
    if (indent === "") {
      ctx.forceBlockIndent = true;
      return blockString(item, ctx, onComment, onChompKeep);
    } else if (implicitKey && indent === indentStep) {
      return quotedString(value, ctx);
    }
  }
  const str = value.replace(/\n+/g, `$&
${indent}`);
  if (actualString) {
    const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
    const { compat, tags } = ctx.doc.schema;
    if (tags.some(test) || compat?.some(test))
      return quotedString(value, ctx);
  }
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
  const { implicitKey, inFlow } = ctx;
  const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
  let { type } = item;
  if (type !== Scalar.QUOTE_DOUBLE) {
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
      type = Scalar.QUOTE_DOUBLE;
  }
  const _stringify = (_type) => {
    switch (_type) {
      case Scalar.BLOCK_FOLDED:
      case Scalar.BLOCK_LITERAL:
        return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
      case Scalar.QUOTE_DOUBLE:
        return doubleQuotedString(ss.value, ctx);
      case Scalar.QUOTE_SINGLE:
        return singleQuotedString(ss.value, ctx);
      case Scalar.PLAIN:
        return plainString(ss, ctx, onComment, onChompKeep);
      default:
        return null;
    }
  };
  let res = _stringify(type);
  if (res === null) {
    const { defaultKeyType, defaultStringType } = ctx.options;
    const t = implicitKey && defaultKeyType || defaultStringType;
    res = _stringify(t);
    if (res === null)
      throw new Error(`Unsupported default string type ${t}`);
  }
  return res;
}

// node_modules/yaml/browser/dist/stringify/stringify.js
function createStringifyContext(doc, options) {
  const opt = Object.assign({
    blockQuote: true,
    commentString: stringifyComment,
    defaultKeyType: null,
    defaultStringType: "PLAIN",
    directives: null,
    doubleQuotedAsJSON: false,
    doubleQuotedMinMultiLineLength: 40,
    falseStr: "false",
    flowCollectionPadding: true,
    indentSeq: true,
    lineWidth: 80,
    minContentWidth: 20,
    nullStr: "null",
    simpleKeys: false,
    singleQuote: null,
    trailingComma: false,
    trueStr: "true",
    verifyAliasOrder: true
  }, doc.schema.toStringOptions, options);
  let inFlow;
  switch (opt.collectionStyle) {
    case "block":
      inFlow = false;
      break;
    case "flow":
      inFlow = true;
      break;
    default:
      inFlow = null;
  }
  return {
    anchors: /* @__PURE__ */ new Set(),
    doc,
    flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
    indent: "",
    indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
    inFlow,
    options: opt
  };
}
function getTagObject(tags, item) {
  if (item.tag) {
    const match = tags.filter((t) => t.tag === item.tag);
    if (match.length > 0)
      return match.find((t) => t.format === item.format) ?? match[0];
  }
  let tagObj = void 0;
  let obj;
  if (isScalar(item)) {
    obj = item.value;
    let match = tags.filter((t) => t.identify?.(obj));
    if (match.length > 1) {
      const testMatch = match.filter((t) => t.test);
      if (testMatch.length > 0)
        match = testMatch;
    }
    tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
  } else {
    obj = item;
    tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
  }
  if (!tagObj) {
    const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
    throw new Error(`Tag not resolved for ${name} value`);
  }
  return tagObj;
}
function stringifyProps(node, tagObj, { anchors, doc }) {
  if (!doc.directives)
    return "";
  const props = [];
  const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
  if (anchor && anchorIsValid(anchor)) {
    anchors.add(anchor);
    props.push(`&${anchor}`);
  }
  const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
  if (tag)
    props.push(doc.directives.tagString(tag));
  return props.join(" ");
}
function stringify(item, ctx, onComment, onChompKeep) {
  if (isPair(item))
    return item.toString(ctx, onComment, onChompKeep);
  if (isAlias(item)) {
    if (ctx.doc.directives)
      return item.toString(ctx);
    if (ctx.resolvedAliases?.has(item)) {
      throw new TypeError(`Cannot stringify circular structure without alias nodes`);
    } else {
      if (ctx.resolvedAliases)
        ctx.resolvedAliases.add(item);
      else
        ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
      item = item.resolve(ctx.doc);
    }
  }
  let tagObj = void 0;
  const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
  tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
  const props = stringifyProps(node, tagObj, ctx);
  if (props.length > 0)
    ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
  const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
  if (!props)
    return str;
  return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
}

// node_modules/yaml/browser/dist/stringify/stringifyPair.js
function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
  const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
  let keyComment = isNode(key) && key.comment || null;
  if (simpleKeys) {
    if (keyComment) {
      throw new Error("With simple keys, key nodes cannot have comments");
    }
    if (isCollection(key) || !isNode(key) && typeof key === "object") {
      const msg = "With simple keys, collection cannot be used as a key value";
      throw new Error(msg);
    }
  }
  let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
  ctx = Object.assign({}, ctx, {
    allNullValues: false,
    implicitKey: !explicitKey && (simpleKeys || !allNullValues),
    indent: indent + indentStep
  });
  let keyCommentDone = false;
  let chompKeep = false;
  let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
  if (!explicitKey && !ctx.inFlow && str.length > 1024) {
    if (simpleKeys)
      throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
    explicitKey = true;
  }
  if (ctx.inFlow) {
    if (allNullValues || value == null) {
      if (keyCommentDone && onComment)
        onComment();
      return str === "" ? "?" : explicitKey ? `? ${str}` : str;
    }
  } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
    str = `? ${str}`;
    if (keyComment && !keyCommentDone) {
      str += lineComment(str, ctx.indent, commentString(keyComment));
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  if (keyCommentDone)
    keyComment = null;
  if (explicitKey) {
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
    str = `? ${str}
${indent}:`;
  } else {
    str = `${str}:`;
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
  }
  let vsb, vcb, valueComment;
  if (isNode(value)) {
    vsb = !!value.spaceBefore;
    vcb = value.commentBefore;
    valueComment = value.comment;
  } else {
    vsb = false;
    vcb = null;
    valueComment = null;
    if (value && typeof value === "object")
      value = doc.createNode(value);
  }
  ctx.implicitKey = false;
  if (!explicitKey && !keyComment && isScalar(value))
    ctx.indentAtStart = str.length + 1;
  chompKeep = false;
  if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
    ctx.indent = ctx.indent.substring(2);
  }
  let valueCommentDone = false;
  const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
  let ws = " ";
  if (keyComment || vsb || vcb) {
    ws = vsb ? "\n" : "";
    if (vcb) {
      const cs = commentString(vcb);
      ws += `
${indentComment(cs, ctx.indent)}`;
    }
    if (valueStr === "" && !ctx.inFlow) {
      if (ws === "\n" && valueComment)
        ws = "\n\n";
    } else {
      ws += `
${ctx.indent}`;
    }
  } else if (!explicitKey && isCollection(value)) {
    const vs0 = valueStr[0];
    const nl0 = valueStr.indexOf("\n");
    const hasNewline = nl0 !== -1;
    const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
    if (hasNewline || !flow) {
      let hasPropsLine = false;
      if (hasNewline && (vs0 === "&" || vs0 === "!")) {
        let sp0 = valueStr.indexOf(" ");
        if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
          sp0 = valueStr.indexOf(" ", sp0 + 1);
        }
        if (sp0 === -1 || nl0 < sp0)
          hasPropsLine = true;
      }
      if (!hasPropsLine)
        ws = `
${ctx.indent}`;
    }
  } else if (valueStr === "" || valueStr[0] === "\n") {
    ws = "";
  }
  str += ws + valueStr;
  if (ctx.inFlow) {
    if (valueCommentDone && onComment)
      onComment();
  } else if (valueComment && !valueCommentDone) {
    str += lineComment(str, ctx.indent, commentString(valueComment));
  } else if (chompKeep && onChompKeep) {
    onChompKeep();
  }
  return str;
}

// node_modules/yaml/browser/dist/log.js
function warn(logLevel, warning) {
  if (logLevel === "debug" || logLevel === "warn") {
    console.warn(warning);
  }
}

// node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
var MERGE_KEY = "<<";
var merge = {
  identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
  default: "key",
  tag: "tag:yaml.org,2002:merge",
  test: /^<<$/,
  resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
    addToJSMap: addMergeToJSMap
  }),
  stringify: () => MERGE_KEY
};
var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map3, value) {
  const source = resolveAliasValue(ctx, value);
  if (isSeq(source))
    for (const it of source.items)
      mergeValue(ctx, map3, it);
  else if (Array.isArray(source))
    for (const it of source)
      mergeValue(ctx, map3, it);
  else
    mergeValue(ctx, map3, source);
}
function mergeValue(ctx, map3, value) {
  const source = resolveAliasValue(ctx, value);
  if (!isMap(source))
    throw new Error("Merge sources must be maps or map aliases");
  const srcMap = source.toJSON(null, ctx, Map);
  for (const [key, value2] of srcMap) {
    if (map3 instanceof Map) {
      if (!map3.has(key))
        map3.set(key, value2);
    } else if (map3 instanceof Set) {
      map3.add(key);
    } else if (!Object.prototype.hasOwnProperty.call(map3, key)) {
      Object.defineProperty(map3, key, {
        value: value2,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  return map3;
}
function resolveAliasValue(ctx, value) {
  return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}

// node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
function addPairToJSMap(ctx, map3, { key, value }) {
  if (isNode(key) && key.addToJSMap)
    key.addToJSMap(ctx, map3, value);
  else if (isMergeKey(ctx, key))
    addMergeToJSMap(ctx, map3, value);
  else {
    const jsKey = toJS(key, "", ctx);
    if (map3 instanceof Map) {
      map3.set(jsKey, toJS(value, jsKey, ctx));
    } else if (map3 instanceof Set) {
      map3.add(jsKey);
    } else {
      const stringKey = stringifyKey(key, jsKey, ctx);
      const jsValue = toJS(value, stringKey, ctx);
      if (stringKey in map3)
        Object.defineProperty(map3, stringKey, {
          value: jsValue,
          writable: true,
          enumerable: true,
          configurable: true
        });
      else
        map3[stringKey] = jsValue;
    }
  }
  return map3;
}
function stringifyKey(key, jsKey, ctx) {
  if (jsKey === null)
    return "";
  if (typeof jsKey !== "object")
    return String(jsKey);
  if (isNode(key) && ctx?.doc) {
    const strCtx = createStringifyContext(ctx.doc, {});
    strCtx.anchors = /* @__PURE__ */ new Set();
    for (const node of ctx.anchors.keys())
      strCtx.anchors.add(node.anchor);
    strCtx.inFlow = true;
    strCtx.inStringifyKey = true;
    const strKey = key.toString(strCtx);
    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey);
      if (jsonStr.length > 40)
        jsonStr = jsonStr.substring(0, 36) + '..."';
      warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
      ctx.mapKeyWarned = true;
    }
    return strKey;
  }
  return JSON.stringify(jsKey);
}

// node_modules/yaml/browser/dist/nodes/Pair.js
function createPair(key, value, ctx) {
  const k = createNode(key, void 0, ctx);
  const v = createNode(value, void 0, ctx);
  return new Pair(k, v);
}
var Pair = class _Pair {
  constructor(key, value = null) {
    Object.defineProperty(this, NODE_TYPE, { value: PAIR });
    this.key = key;
    this.value = value;
  }
  clone(schema4) {
    let { key, value } = this;
    if (isNode(key))
      key = key.clone(schema4);
    if (isNode(value))
      value = value.clone(schema4);
    return new _Pair(key, value);
  }
  toJSON(_, ctx) {
    const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    return addPairToJSMap(ctx, pair, this);
  }
  toString(ctx, onComment, onChompKeep) {
    return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyCollection.js
function stringifyCollection(collection, ctx, options) {
  const flow = ctx.inFlow ?? collection.flow;
  const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
  return stringify4(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
  const { indent, options: { commentString } } = ctx;
  const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
  let chompKeep = false;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment2 = null;
    if (isNode(item)) {
      if (!chompKeep && item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
      if (item.comment)
        comment2 = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (!chompKeep && ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
      }
    }
    chompKeep = false;
    let str2 = stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
    if (comment2)
      str2 += lineComment(str2, itemIndent, commentString(comment2));
    if (chompKeep && comment2)
      chompKeep = false;
    lines.push(blockItemPrefix + str2);
  }
  let str;
  if (lines.length === 0) {
    str = flowChars.start + flowChars.end;
  } else {
    str = lines[0];
    for (let i = 1; i < lines.length; ++i) {
      const line = lines[i];
      str += line ? `
${indent}${line}` : "\n";
    }
  }
  if (comment) {
    str += "\n" + indentComment(commentString(comment), indent);
    if (onComment)
      onComment();
  } else if (chompKeep && onChompKeep)
    onChompKeep();
  return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
  const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
  itemIndent += indentStep;
  const itemCtx = Object.assign({}, ctx, {
    indent: itemIndent,
    inFlow: true,
    type: null
  });
  let reqNewline = false;
  let linesAtValue = 0;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment = null;
    if (isNode(item)) {
      if (item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, false);
      if (item.comment)
        comment = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, false);
        if (ik.comment)
          reqNewline = true;
      }
      const iv = isNode(item.value) ? item.value : null;
      if (iv) {
        if (iv.comment)
          comment = iv.comment;
        if (iv.commentBefore)
          reqNewline = true;
      } else if (item.value == null && ik?.comment) {
        comment = ik.comment;
      }
    }
    if (comment)
      reqNewline = true;
    let str = stringify(item, itemCtx, () => comment = null);
    reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
    if (i < items.length - 1) {
      str += ",";
    } else if (ctx.options.trailingComma) {
      if (ctx.options.lineWidth > 0) {
        reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
      }
      if (reqNewline) {
        str += ",";
      }
    }
    if (comment)
      str += lineComment(str, itemIndent, commentString(comment));
    lines.push(str);
    linesAtValue = lines.length;
  }
  const { start, end } = flowChars;
  if (lines.length === 0) {
    return start + end;
  } else {
    if (!reqNewline) {
      const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
      reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
    }
    if (reqNewline) {
      let str = start;
      for (const line of lines)
        str += line ? `
${indentStep}${indent}${line}` : "\n";
      return `${str}
${indent}${end}`;
    } else {
      return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
    }
  }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
  if (comment && chompKeep)
    comment = comment.replace(/^\n+/, "");
  if (comment) {
    const ic = indentComment(commentString(comment), indent);
    lines.push(ic.trimStart());
  }
}

// node_modules/yaml/browser/dist/nodes/YAMLMap.js
function findPair(items, key) {
  const k = isScalar(key) ? key.value : key;
  for (const it of items) {
    if (isPair(it)) {
      if (it.key === key || it.key === k)
        return it;
      if (isScalar(it.key) && it.key.value === k)
        return it;
    }
  }
  return void 0;
}
var YAMLMap = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:map";
  }
  constructor(schema4) {
    super(MAP, schema4);
    this.items = [];
  }
  /**
   * A generic collection parsing method that can be extended
   * to other node classes that inherit from YAMLMap
   */
  static from(schema4, obj, ctx) {
    const { keepUndefined, replacer } = ctx;
    const map3 = new this(schema4);
    const add = (key, value) => {
      if (typeof replacer === "function")
        value = replacer.call(obj, key, value);
      else if (Array.isArray(replacer) && !replacer.includes(key))
        return;
      if (value !== void 0 || keepUndefined)
        map3.items.push(createPair(key, value, ctx));
    };
    if (obj instanceof Map) {
      for (const [key, value] of obj)
        add(key, value);
    } else if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj))
        add(key, obj[key]);
    }
    if (typeof schema4.sortMapEntries === "function") {
      map3.items.sort(schema4.sortMapEntries);
    }
    return map3;
  }
  /**
   * Adds a value to the collection.
   *
   * @param overwrite - If not set `true`, using a key that is already in the
   *   collection will throw. Otherwise, overwrites the previous value.
   */
  add(pair, overwrite) {
    let _pair;
    if (isPair(pair))
      _pair = pair;
    else if (!pair || typeof pair !== "object" || !("key" in pair)) {
      _pair = new Pair(pair, pair?.value);
    } else
      _pair = new Pair(pair.key, pair.value);
    const prev = findPair(this.items, _pair.key);
    const sortEntries = this.schema?.sortMapEntries;
    if (prev) {
      if (!overwrite)
        throw new Error(`Key ${_pair.key} already set`);
      if (isScalar(prev.value) && isScalarValue(_pair.value))
        prev.value.value = _pair.value;
      else
        prev.value = _pair.value;
    } else if (sortEntries) {
      const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
      if (i === -1)
        this.items.push(_pair);
      else
        this.items.splice(i, 0, _pair);
    } else {
      this.items.push(_pair);
    }
  }
  delete(key) {
    const it = findPair(this.items, key);
    if (!it)
      return false;
    const del = this.items.splice(this.items.indexOf(it), 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const it = findPair(this.items, key);
    const node = it?.value;
    return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
  }
  has(key) {
    return !!findPair(this.items, key);
  }
  set(key, value) {
    this.add(new Pair(key, value), true);
  }
  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */
  toJSON(_, ctx, Type) {
    const map3 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    if (ctx?.onCreate)
      ctx.onCreate(map3);
    for (const item of this.items)
      addPairToJSMap(ctx, map3, item);
    return map3;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    for (const item of this.items) {
      if (!isPair(item))
        throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
    }
    if (!ctx.allNullValues && this.hasAllNullValues(false))
      ctx = Object.assign({}, ctx, { allNullValues: true });
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "",
      flowChars: { start: "{", end: "}" },
      itemIndent: ctx.indent || "",
      onChompKeep,
      onComment
    });
  }
};

// node_modules/yaml/browser/dist/schema/common/map.js
var map = {
  collection: "map",
  default: true,
  nodeClass: YAMLMap,
  tag: "tag:yaml.org,2002:map",
  resolve(map3, onError) {
    if (!isMap(map3))
      onError("Expected a mapping for this tag");
    return map3;
  },
  createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/nodes/YAMLSeq.js
var YAMLSeq = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:seq";
  }
  constructor(schema4) {
    super(SEQ, schema4);
    this.items = [];
  }
  add(value) {
    this.items.push(value);
  }
  /**
   * Removes a value from the collection.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   *
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return false;
    const del = this.items.splice(idx, 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return void 0;
    const it = this.items[idx];
    return !keepScalar && isScalar(it) ? it.value : it;
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   */
  has(key) {
    const idx = asItemIndex(key);
    return typeof idx === "number" && idx < this.items.length;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   *
   * If `key` does not contain a representation of an integer, this will throw.
   * It may be wrapped in a `Scalar`.
   */
  set(key, value) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      throw new Error(`Expected a valid index, not ${key}.`);
    const prev = this.items[idx];
    if (isScalar(prev) && isScalarValue(value))
      prev.value = value;
    else
      this.items[idx] = value;
  }
  toJSON(_, ctx) {
    const seq2 = [];
    if (ctx?.onCreate)
      ctx.onCreate(seq2);
    let i = 0;
    for (const item of this.items)
      seq2.push(toJS(item, String(i++), ctx));
    return seq2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "- ",
      flowChars: { start: "[", end: "]" },
      itemIndent: (ctx.indent || "") + "  ",
      onChompKeep,
      onComment
    });
  }
  static from(schema4, obj, ctx) {
    const { replacer } = ctx;
    const seq2 = new this(schema4);
    if (obj && Symbol.iterator in Object(obj)) {
      let i = 0;
      for (let it of obj) {
        if (typeof replacer === "function") {
          const key = obj instanceof Set ? it : String(i++);
          it = replacer.call(obj, key, it);
        }
        seq2.items.push(createNode(it, void 0, ctx));
      }
    }
    return seq2;
  }
};
function asItemIndex(key) {
  let idx = isScalar(key) ? key.value : key;
  if (idx && typeof idx === "string")
    idx = Number(idx);
  return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
}

// node_modules/yaml/browser/dist/schema/common/seq.js
var seq = {
  collection: "seq",
  default: true,
  nodeClass: YAMLSeq,
  tag: "tag:yaml.org,2002:seq",
  resolve(seq2, onError) {
    if (!isSeq(seq2))
      onError("Expected a sequence for this tag");
    return seq2;
  },
  createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/schema/common/string.js
var string = {
  identify: (value) => typeof value === "string",
  default: true,
  tag: "tag:yaml.org,2002:str",
  resolve: (str) => str,
  stringify(item, ctx, onComment, onChompKeep) {
    ctx = Object.assign({ actualString: true }, ctx);
    return stringifyString(item, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/common/null.js
var nullTag = {
  identify: (value) => value == null,
  createNode: () => new Scalar(null),
  default: true,
  tag: "tag:yaml.org,2002:null",
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: () => new Scalar(null),
  stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
};

// node_modules/yaml/browser/dist/schema/core/bool.js
var boolTag = {
  identify: (value) => typeof value === "boolean",
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
  resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
  stringify({ source, value }, ctx) {
    if (source && boolTag.test.test(source)) {
      const sv = source[0] === "t" || source[0] === "T";
      if (value === sv)
        return source;
    }
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyNumber.js
function stringifyNumber({ format: format2, minFractionDigits, tag, value }) {
  if (typeof value === "bigint")
    return String(value);
  const num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num))
    return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
  let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
  if (!format2 && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
    let i = n.indexOf(".");
    if (i < 0) {
      i = n.length;
      n += ".";
    }
    let d = minFractionDigits - (n.length - i - 1);
    while (d-- > 0)
      n += "0";
  }
  return n;
}

// node_modules/yaml/browser/dist/schema/core/float.js
var floatNaN = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str));
    const dot = str.indexOf(".");
    if (dot !== -1 && str[str.length - 1] === "0")
      node.minFractionDigits = str.length - dot - 1;
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/core/int.js
var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
function intStringify(node, radix, prefix) {
  const { value } = node;
  if (intIdentify(value) && value >= 0)
    return prefix + value.toString(radix);
  return stringifyNumber(node);
}
var intOct = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^0o[0-7]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
  stringify: (node) => intStringify(node, 8, "0o")
};
var int = {
  identify: intIdentify,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^0x[0-9a-fA-F]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
  stringify: (node) => intStringify(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/core/schema.js
var schema = [
  map,
  seq,
  string,
  nullTag,
  boolTag,
  intOct,
  int,
  intHex,
  floatNaN,
  floatExp,
  float
];

// node_modules/yaml/browser/dist/schema/json/schema.js
function intIdentify2(value) {
  return typeof value === "bigint" || Number.isInteger(value);
}
var stringifyJSON = ({ value }) => JSON.stringify(value);
var jsonScalars = [
  {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify: stringifyJSON
  },
  {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^null$/,
    resolve: () => null,
    stringify: stringifyJSON
  },
  {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^true$|^false$/,
    resolve: (str) => str === "true",
    stringify: stringifyJSON
  },
  {
    identify: intIdentify2,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^-?(?:0|[1-9][0-9]*)$/,
    resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
    stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
  },
  {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
    resolve: (str) => parseFloat(str),
    stringify: stringifyJSON
  }
];
var jsonError = {
  default: true,
  tag: "",
  test: /^/,
  resolve(str, onError) {
    onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
    return str;
  }
};
var schema2 = [map, seq].concat(jsonScalars, jsonError);

// node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
var binary = {
  identify: (value) => value instanceof Uint8Array,
  // Buffer inherits from Uint8Array
  default: false,
  tag: "tag:yaml.org,2002:binary",
  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve(src, onError) {
    if (typeof atob === "function") {
      const str = atob(src.replace(/[\n\r]/g, ""));
      const buffer = new Uint8Array(str.length);
      for (let i = 0; i < str.length; ++i)
        buffer[i] = str.charCodeAt(i);
      return buffer;
    } else {
      onError("This environment does not support reading binary tags; either Buffer or atob is required");
      return src;
    }
  },
  stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
    if (!value)
      return "";
    const buf = value;
    let str;
    if (typeof btoa === "function") {
      let s = "";
      for (let i = 0; i < buf.length; ++i)
        s += String.fromCharCode(buf[i]);
      str = btoa(s);
    } else {
      throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
    }
    type ?? (type = Scalar.BLOCK_LITERAL);
    if (type !== Scalar.QUOTE_DOUBLE) {
      const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
      const n = Math.ceil(str.length / lineWidth);
      const lines = new Array(n);
      for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
        lines[i] = str.substr(o, lineWidth);
      }
      str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
    }
    return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
function resolvePairs(seq2, onError) {
  if (isSeq(seq2)) {
    for (let i = 0; i < seq2.items.length; ++i) {
      let item = seq2.items[i];
      if (isPair(item))
        continue;
      else if (isMap(item)) {
        if (item.items.length > 1)
          onError("Each pair must have its own sequence indicator");
        const pair = item.items[0] || new Pair(new Scalar(null));
        if (item.commentBefore)
          pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
        if (item.comment) {
          const cn = pair.value ?? pair.key;
          cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
        }
        item = pair;
      }
      seq2.items[i] = isPair(item) ? item : new Pair(item);
    }
  } else
    onError("Expected a sequence for this tag");
  return seq2;
}
function createPairs(schema4, iterable, ctx) {
  const { replacer } = ctx;
  const pairs2 = new YAMLSeq(schema4);
  pairs2.tag = "tag:yaml.org,2002:pairs";
  let i = 0;
  if (iterable && Symbol.iterator in Object(iterable))
    for (let it of iterable) {
      if (typeof replacer === "function")
        it = replacer.call(iterable, String(i++), it);
      let key, value;
      if (Array.isArray(it)) {
        if (it.length === 2) {
          key = it[0];
          value = it[1];
        } else
          throw new TypeError(`Expected [key, value] tuple: ${it}`);
      } else if (it && it instanceof Object) {
        const keys = Object.keys(it);
        if (keys.length === 1) {
          key = keys[0];
          value = it[key];
        } else {
          throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
        }
      } else {
        key = it;
      }
      pairs2.items.push(createPair(key, value, ctx));
    }
  return pairs2;
}
var pairs = {
  collection: "seq",
  default: false,
  tag: "tag:yaml.org,2002:pairs",
  resolve: resolvePairs,
  createNode: createPairs
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
var YAMLOMap = class _YAMLOMap extends YAMLSeq {
  constructor() {
    super();
    this.add = YAMLMap.prototype.add.bind(this);
    this.delete = YAMLMap.prototype.delete.bind(this);
    this.get = YAMLMap.prototype.get.bind(this);
    this.has = YAMLMap.prototype.has.bind(this);
    this.set = YAMLMap.prototype.set.bind(this);
    this.tag = _YAMLOMap.tag;
  }
  /**
   * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
   * but TypeScript won't allow widening the signature of a child method.
   */
  toJSON(_, ctx) {
    if (!ctx)
      return super.toJSON(_);
    const map3 = /* @__PURE__ */ new Map();
    if (ctx?.onCreate)
      ctx.onCreate(map3);
    for (const pair of this.items) {
      let key, value;
      if (isPair(pair)) {
        key = toJS(pair.key, "", ctx);
        value = toJS(pair.value, key, ctx);
      } else {
        key = toJS(pair, "", ctx);
      }
      if (map3.has(key))
        throw new Error("Ordered maps must not include duplicate keys");
      map3.set(key, value);
    }
    return map3;
  }
  static from(schema4, iterable, ctx) {
    const pairs2 = createPairs(schema4, iterable, ctx);
    const omap2 = new this();
    omap2.items = pairs2.items;
    return omap2;
  }
};
YAMLOMap.tag = "tag:yaml.org,2002:omap";
var omap = {
  collection: "seq",
  identify: (value) => value instanceof Map,
  nodeClass: YAMLOMap,
  default: false,
  tag: "tag:yaml.org,2002:omap",
  resolve(seq2, onError) {
    const pairs2 = resolvePairs(seq2, onError);
    const seenKeys = [];
    for (const { key } of pairs2.items) {
      if (isScalar(key)) {
        if (seenKeys.includes(key.value)) {
          onError(`Ordered maps must not include duplicate keys: ${key.value}`);
        } else {
          seenKeys.push(key.value);
        }
      }
    }
    return Object.assign(new YAMLOMap(), pairs2);
  },
  createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
function boolStringify({ value, source }, ctx) {
  const boolObj = value ? trueTag : falseTag;
  if (source && boolObj.test.test(source))
    return source;
  return value ? ctx.options.trueStr : ctx.options.falseStr;
}
var trueTag = {
  identify: (value) => value === true,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
  resolve: () => new Scalar(true),
  stringify: boolStringify
};
var falseTag = {
  identify: (value) => value === false,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
  resolve: () => new Scalar(false),
  stringify: boolStringify
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
var floatNaN2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str.replace(/_/g, "")),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str.replace(/_/g, "")));
    const dot = str.indexOf(".");
    if (dot !== -1) {
      const f = str.substring(dot + 1).replace(/_/g, "");
      if (f[f.length - 1] === "0")
        node.minFractionDigits = f.length;
    }
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
function intResolve2(str, offset, radix, { intAsBigInt }) {
  const sign = str[0];
  if (sign === "-" || sign === "+")
    offset += 1;
  str = str.substring(offset).replace(/_/g, "");
  if (intAsBigInt) {
    switch (radix) {
      case 2:
        str = `0b${str}`;
        break;
      case 8:
        str = `0o${str}`;
        break;
      case 16:
        str = `0x${str}`;
        break;
    }
    const n2 = BigInt(str);
    return sign === "-" ? BigInt(-1) * n2 : n2;
  }
  const n = parseInt(str, radix);
  return sign === "-" ? -1 * n : n;
}
function intStringify2(node, radix, prefix) {
  const { value } = node;
  if (intIdentify3(value)) {
    const str = value.toString(radix);
    return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
  }
  return stringifyNumber(node);
}
var intBin = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "BIN",
  test: /^[-+]?0b[0-1_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
  stringify: (node) => intStringify2(node, 2, "0b")
};
var intOct2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^[-+]?0[0-7_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
  stringify: (node) => intStringify2(node, 8, "0")
};
var int2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9][0-9_]*$/,
  resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^[-+]?0x[0-9a-fA-F_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
  stringify: (node) => intStringify2(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
var YAMLSet = class _YAMLSet extends YAMLMap {
  constructor(schema4) {
    super(schema4);
    this.tag = _YAMLSet.tag;
  }
  add(key) {
    let pair;
    if (isPair(key))
      pair = key;
    else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
      pair = new Pair(key.key, null);
    else
      pair = new Pair(key, null);
    const prev = findPair(this.items, pair.key);
    if (!prev)
      this.items.push(pair);
  }
  /**
   * If `keepPair` is `true`, returns the Pair matching `key`.
   * Otherwise, returns the value of that Pair's key.
   */
  get(key, keepPair) {
    const pair = findPair(this.items, key);
    return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
  }
  set(key, value) {
    if (typeof value !== "boolean")
      throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
    const prev = findPair(this.items, key);
    if (prev && !value) {
      this.items.splice(this.items.indexOf(prev), 1);
    } else if (!prev && value) {
      this.items.push(new Pair(key));
    }
  }
  toJSON(_, ctx) {
    return super.toJSON(_, ctx, Set);
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    if (this.hasAllNullValues(true))
      return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
    else
      throw new Error("Set items must all have null values");
  }
  static from(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const set2 = new this(schema4);
    if (iterable && Symbol.iterator in Object(iterable))
      for (let value of iterable) {
        if (typeof replacer === "function")
          value = replacer.call(iterable, value, value);
        set2.items.push(createPair(value, null, ctx));
      }
    return set2;
  }
};
YAMLSet.tag = "tag:yaml.org,2002:set";
var set = {
  collection: "map",
  identify: (value) => value instanceof Set,
  nodeClass: YAMLSet,
  default: false,
  tag: "tag:yaml.org,2002:set",
  createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
  resolve(map3, onError) {
    if (isMap(map3)) {
      if (map3.hasAllNullValues(true))
        return Object.assign(new YAMLSet(), map3);
      else
        onError("Set items must all have null values");
    } else
      onError("Expected a mapping for this tag");
    return map3;
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
function parseSexagesimal(str, asBigInt) {
  const sign = str[0];
  const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
  const num = (n) => asBigInt ? BigInt(n) : Number(n);
  const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
  return sign === "-" ? num(-1) * res : res;
}
function stringifySexagesimal(node) {
  let { value } = node;
  let num = (n) => n;
  if (typeof value === "bigint")
    num = (n) => BigInt(n);
  else if (isNaN(value) || !isFinite(value))
    return stringifyNumber(node);
  let sign = "";
  if (value < 0) {
    sign = "-";
    value *= num(-1);
  }
  const _60 = num(60);
  const parts = [value % _60];
  if (value < 60) {
    parts.unshift(0);
  } else {
    value = (value - parts[0]) / _60;
    parts.unshift(value % _60);
    if (value >= 60) {
      value = (value - parts[0]) / _60;
      parts.unshift(value);
    }
  }
  return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
}
var intTime = {
  identify: (value) => typeof value === "bigint" || Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
  resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
  stringify: stringifySexagesimal
};
var floatTime = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
  resolve: (str) => parseSexagesimal(str, false),
  stringify: stringifySexagesimal
};
var timestamp = {
  identify: (value) => value instanceof Date,
  default: true,
  tag: "tag:yaml.org,2002:timestamp",
  // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
  // may be omitted altogether, resulting in a date format. In such a case, the time part is
  // assumed to be 00:00:00Z (start of day, UTC).
  test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
  resolve(str) {
    const match = str.match(timestamp.test);
    if (!match)
      throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
    let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
    const tz = match[8];
    if (tz && tz !== "Z") {
      let d = parseSexagesimal(tz, false);
      if (Math.abs(d) < 30)
        d *= 60;
      date -= 6e4 * d;
    }
    return new Date(date);
  },
  stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
var schema3 = [
  map,
  seq,
  string,
  nullTag,
  trueTag,
  falseTag,
  intBin,
  intOct2,
  int2,
  intHex2,
  floatNaN2,
  floatExp2,
  float2,
  binary,
  merge,
  omap,
  pairs,
  set,
  intTime,
  floatTime,
  timestamp
];

// node_modules/yaml/browser/dist/schema/tags.js
var schemas = /* @__PURE__ */ new Map([
  ["core", schema],
  ["failsafe", [map, seq, string]],
  ["json", schema2],
  ["yaml11", schema3],
  ["yaml-1.1", schema3]
]);
var tagsByName = {
  binary,
  bool: boolTag,
  float,
  floatExp,
  floatNaN,
  floatTime,
  int,
  intHex,
  intOct,
  intTime,
  map,
  merge,
  null: nullTag,
  omap,
  pairs,
  seq,
  set,
  timestamp
};
var coreKnownTags = {
  "tag:yaml.org,2002:binary": binary,
  "tag:yaml.org,2002:merge": merge,
  "tag:yaml.org,2002:omap": omap,
  "tag:yaml.org,2002:pairs": pairs,
  "tag:yaml.org,2002:set": set,
  "tag:yaml.org,2002:timestamp": timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
  const schemaTags = schemas.get(schemaName);
  if (schemaTags && !customTags) {
    return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
  }
  let tags = schemaTags;
  if (!tags) {
    if (Array.isArray(customTags))
      tags = [];
    else {
      const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
    }
  }
  if (Array.isArray(customTags)) {
    for (const tag of customTags)
      tags = tags.concat(tag);
  } else if (typeof customTags === "function") {
    tags = customTags(tags.slice());
  }
  if (addMergeTag)
    tags = tags.concat(merge);
  return tags.reduce((tags2, tag) => {
    const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
    if (!tagObj) {
      const tagName = JSON.stringify(tag);
      const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
    }
    if (!tags2.includes(tagObj))
      tags2.push(tagObj);
    return tags2;
  }, []);
}

// node_modules/yaml/browser/dist/schema/Schema.js
var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var Schema = class _Schema {
  constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
    this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
    this.name = typeof schema4 === "string" && schema4 || "core";
    this.knownTags = resolveKnownTags ? coreKnownTags : {};
    this.tags = getTags(customTags, this.name, merge2);
    this.toStringOptions = toStringDefaults ?? null;
    Object.defineProperty(this, MAP, { value: map });
    Object.defineProperty(this, SCALAR, { value: string });
    Object.defineProperty(this, SEQ, { value: seq });
    this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
  }
  clone() {
    const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
    copy.tags = this.tags.slice();
    return copy;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyDocument.js
function stringifyDocument(doc, options) {
  const lines = [];
  let hasDirectives = options.directives === true;
  if (options.directives !== false && doc.directives) {
    const dir = doc.directives.toString(doc);
    if (dir) {
      lines.push(dir);
      hasDirectives = true;
    } else if (doc.directives.docStart)
      hasDirectives = true;
  }
  if (hasDirectives)
    lines.push("---");
  const ctx = createStringifyContext(doc, options);
  const { commentString } = ctx.options;
  if (doc.commentBefore) {
    if (lines.length !== 1)
      lines.unshift("");
    const cs = commentString(doc.commentBefore);
    lines.unshift(indentComment(cs, ""));
  }
  let chompKeep = false;
  let contentComment = null;
  if (doc.contents) {
    if (isNode(doc.contents)) {
      if (doc.contents.spaceBefore && hasDirectives)
        lines.push("");
      if (doc.contents.commentBefore) {
        const cs = commentString(doc.contents.commentBefore);
        lines.push(indentComment(cs, ""));
      }
      ctx.forceBlockIndent = !!doc.comment;
      contentComment = doc.contents.comment;
    }
    const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
    let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
    if (contentComment)
      body += lineComment(body, "", commentString(contentComment));
    if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
      lines[lines.length - 1] = `--- ${body}`;
    } else
      lines.push(body);
  } else {
    lines.push(stringify(doc.contents, ctx));
  }
  if (doc.directives?.docEnd) {
    if (doc.comment) {
      const cs = commentString(doc.comment);
      if (cs.includes("\n")) {
        lines.push("...");
        lines.push(indentComment(cs, ""));
      } else {
        lines.push(`... ${cs}`);
      }
    } else {
      lines.push("...");
    }
  } else {
    let dc = doc.comment;
    if (dc && chompKeep)
      dc = dc.replace(/^\n+/, "");
    if (dc) {
      if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(indentComment(commentString(dc), ""));
    }
  }
  return lines.join("\n") + "\n";
}

// node_modules/yaml/browser/dist/doc/Document.js
var Document = class _Document {
  constructor(value, replacer, options) {
    this.commentBefore = null;
    this.comment = null;
    this.errors = [];
    this.warnings = [];
    Object.defineProperty(this, NODE_TYPE, { value: DOC });
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const opt = Object.assign({
      intAsBigInt: false,
      keepSourceTokens: false,
      logLevel: "warn",
      prettyErrors: true,
      strict: true,
      stringKeys: false,
      uniqueKeys: true,
      version: "1.2"
    }, options);
    this.options = opt;
    let { version } = opt;
    if (options?._directives) {
      this.directives = options._directives.atDocument();
      if (this.directives.yaml.explicit)
        version = this.directives.yaml.version;
    } else
      this.directives = new Directives({ version });
    this.setSchema(version, options);
    this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
  }
  /**
   * Create a deep copy of this Document and its contents.
   *
   * Custom Node values that inherit from `Object` still refer to their original instances.
   */
  clone() {
    const copy = Object.create(_Document.prototype, {
      [NODE_TYPE]: { value: DOC }
    });
    copy.commentBefore = this.commentBefore;
    copy.comment = this.comment;
    copy.errors = this.errors.slice();
    copy.warnings = this.warnings.slice();
    copy.options = Object.assign({}, this.options);
    if (this.directives)
      copy.directives = this.directives.clone();
    copy.schema = this.schema.clone();
    copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** Adds a value to the document. */
  add(value) {
    if (assertCollection(this.contents))
      this.contents.add(value);
  }
  /** Adds a value to the document. */
  addIn(path, value) {
    if (assertCollection(this.contents))
      this.contents.addIn(path, value);
  }
  /**
   * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
   *
   * If `node` already has an anchor, `name` is ignored.
   * Otherwise, the `node.anchor` value will be set to `name`,
   * or if an anchor with that name is already present in the document,
   * `name` will be used as a prefix for a new unique anchor.
   * If `name` is undefined, the generated anchor will use 'a' as a prefix.
   */
  createAlias(node, name) {
    if (!node.anchor) {
      const prev = anchorNames(this);
      node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
    }
    return new Alias(node.anchor);
  }
  createNode(value, replacer, options) {
    let _replacer = void 0;
    if (typeof replacer === "function") {
      value = replacer.call({ "": value }, "", value);
      _replacer = replacer;
    } else if (Array.isArray(replacer)) {
      const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
      const asStr = replacer.filter(keyToStr).map(String);
      if (asStr.length > 0)
        replacer = replacer.concat(asStr);
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
    const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
      this,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      anchorPrefix || "a"
    );
    const ctx = {
      aliasDuplicateObjects: aliasDuplicateObjects ?? true,
      keepUndefined: keepUndefined ?? false,
      onAnchor,
      onTagObj,
      replacer: _replacer,
      schema: this.schema,
      sourceObjects
    };
    const node = createNode(value, tag, ctx);
    if (flow && isCollection(node))
      node.flow = true;
    setAnchors();
    return node;
  }
  /**
   * Convert a key and a value into a `Pair` using the current schema,
   * recursively wrapping all values as `Scalar` or `Collection` nodes.
   */
  createPair(key, value, options = {}) {
    const k = this.createNode(key, null, options);
    const v = this.createNode(value, null, options);
    return new Pair(k, v);
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    return assertCollection(this.contents) ? this.contents.delete(key) : false;
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path) {
    if (isEmptyPath(path)) {
      if (this.contents == null)
        return false;
      this.contents = null;
      return true;
    }
    return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  get(key, keepScalar) {
    return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
  }
  /**
   * Returns item at `path`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path, keepScalar) {
    if (isEmptyPath(path))
      return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
    return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
  }
  /**
   * Checks if the document includes a value with the key `key`.
   */
  has(key) {
    return isCollection(this.contents) ? this.contents.has(key) : false;
  }
  /**
   * Checks if the document includes a value at `path`.
   */
  hasIn(path) {
    if (isEmptyPath(path))
      return this.contents !== void 0;
    return isCollection(this.contents) ? this.contents.hasIn(path) : false;
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  set(key, value) {
    if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, [key], value);
    } else if (assertCollection(this.contents)) {
      this.contents.set(key, value);
    }
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path, value) {
    if (isEmptyPath(path)) {
      this.contents = value;
    } else if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, Array.from(path), value);
    } else if (assertCollection(this.contents)) {
      this.contents.setIn(path, value);
    }
  }
  /**
   * Change the YAML version and schema used by the document.
   * A `null` version disables support for directives, explicit tags, anchors, and aliases.
   * It also requires the `schema` option to be given as a `Schema` instance value.
   *
   * Overrides all previously set schema options.
   */
  setSchema(version, options = {}) {
    if (typeof version === "number")
      version = String(version);
    let opt;
    switch (version) {
      case "1.1":
        if (this.directives)
          this.directives.yaml.version = "1.1";
        else
          this.directives = new Directives({ version: "1.1" });
        opt = { resolveKnownTags: false, schema: "yaml-1.1" };
        break;
      case "1.2":
      case "next":
        if (this.directives)
          this.directives.yaml.version = version;
        else
          this.directives = new Directives({ version });
        opt = { resolveKnownTags: true, schema: "core" };
        break;
      case null:
        if (this.directives)
          delete this.directives;
        opt = null;
        break;
      default: {
        const sv = JSON.stringify(version);
        throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
      }
    }
    if (options.schema instanceof Object)
      this.schema = options.schema;
    else if (opt)
      this.schema = new Schema(Object.assign(opt, options));
    else
      throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
  }
  // json & jsonArg are only used from toJSON()
  toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc: this,
      keep: !json,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this.contents, jsonArg ?? "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
  /**
   * A JSON representation of the document `contents`.
   *
   * @param jsonArg Used by `JSON.stringify` to indicate the array index or
   *   property name.
   */
  toJSON(jsonArg, onAnchor) {
    return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
  }
  /** A YAML representation of the document. */
  toString(options = {}) {
    if (this.errors.length > 0)
      throw new Error("Document with errors cannot be stringified");
    if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
      const s = JSON.stringify(options.indent);
      throw new Error(`"indent" option must be a positive integer, not ${s}`);
    }
    return stringifyDocument(this, options);
  }
};
function assertCollection(contents) {
  if (isCollection(contents))
    return true;
  throw new Error("Expected a YAML collection as document contents");
}

// node_modules/yaml/browser/dist/errors.js
var YAMLError = class extends Error {
  constructor(name, pos, code2, message) {
    super();
    this.name = name;
    this.code = code2;
    this.message = message;
    this.pos = pos;
  }
};
var YAMLParseError = class extends YAMLError {
  constructor(pos, code2, message) {
    super("YAMLParseError", pos, code2, message);
  }
};
var YAMLWarning = class extends YAMLError {
  constructor(pos, code2, message) {
    super("YAMLWarning", pos, code2, message);
  }
};
var prettifyError = (src, lc) => (error2) => {
  if (error2.pos[0] === -1)
    return;
  error2.linePos = error2.pos.map((pos) => lc.linePos(pos));
  const { line, col } = error2.linePos[0];
  error2.message += ` at line ${line}, column ${col}`;
  let ci = col - 1;
  let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
  if (ci >= 60 && lineStr.length > 80) {
    const trimStart = Math.min(ci - 39, lineStr.length - 79);
    lineStr = "\u2026" + lineStr.substring(trimStart);
    ci -= trimStart - 1;
  }
  if (lineStr.length > 80)
    lineStr = lineStr.substring(0, 79) + "\u2026";
  if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
    let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
    if (prev.length > 80)
      prev = prev.substring(0, 79) + "\u2026\n";
    lineStr = prev + lineStr;
  }
  if (/[^ ]/.test(lineStr)) {
    let count = 1;
    const end = error2.linePos[1];
    if (end?.line === line && end.col > col) {
      count = Math.max(1, Math.min(end.col - col, 80 - ci));
    }
    const pointer = " ".repeat(ci) + "^".repeat(count);
    error2.message += `:

${lineStr}
${pointer}
`;
  }
};

// node_modules/yaml/browser/dist/compose/resolve-props.js
function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
  let spaceBefore = false;
  let atNewline = startOnNewline;
  let hasSpace = startOnNewline;
  let comment = "";
  let commentSep = "";
  let hasNewline = false;
  let reqSpace = false;
  let tab = null;
  let anchor = null;
  let tag = null;
  let newlineAfterProp = null;
  let comma = null;
  let found = null;
  let start = null;
  for (const token of tokens) {
    if (reqSpace) {
      if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
        onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      reqSpace = false;
    }
    if (tab) {
      if (atNewline && token.type !== "comment" && token.type !== "newline") {
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      }
      tab = null;
    }
    switch (token.type) {
      case "space":
        if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
          tab = token;
        }
        hasSpace = true;
        break;
      case "comment": {
        if (!hasSpace)
          onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
        const cb = token.source.substring(1) || " ";
        if (!comment)
          comment = cb;
        else
          comment += commentSep + cb;
        commentSep = "";
        atNewline = false;
        break;
      }
      case "newline":
        if (atNewline) {
          if (comment)
            comment += token.source;
          else if (!found || indicator !== "seq-item-ind")
            spaceBefore = true;
        } else
          commentSep += token.source;
        atNewline = true;
        hasNewline = true;
        if (anchor || tag)
          newlineAfterProp = token;
        hasSpace = true;
        break;
      case "anchor":
        if (anchor)
          onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
        if (token.source.endsWith(":"))
          onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
        anchor = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      case "tag": {
        if (tag)
          onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
        tag = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      }
      case indicator:
        if (anchor || tag)
          onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
        if (found)
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
        found = token;
        atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
        hasSpace = false;
        break;
      case "comma":
        if (flow) {
          if (comma)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
          comma = token;
          atNewline = false;
          hasSpace = false;
          break;
        }
      // else fallthrough
      default:
        onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
        atNewline = false;
        hasSpace = false;
    }
  }
  const last = tokens[tokens.length - 1];
  const end = last ? last.offset + last.source.length : offset;
  if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
    onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
  }
  if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
    onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
  return {
    comma,
    found,
    spaceBefore,
    comment,
    hasNewline,
    anchor,
    tag,
    newlineAfterProp,
    end,
    start: start ?? end
  };
}

// node_modules/yaml/browser/dist/compose/util-contains-newline.js
function containsNewline(key) {
  if (!key)
    return null;
  switch (key.type) {
    case "alias":
    case "scalar":
    case "double-quoted-scalar":
    case "single-quoted-scalar":
      if (key.source.includes("\n"))
        return true;
      if (key.end) {
        for (const st of key.end)
          if (st.type === "newline")
            return true;
      }
      return false;
    case "flow-collection":
      for (const it of key.items) {
        for (const st of it.start)
          if (st.type === "newline")
            return true;
        if (it.sep) {
          for (const st of it.sep)
            if (st.type === "newline")
              return true;
        }
        if (containsNewline(it.key) || containsNewline(it.value))
          return true;
      }
      return false;
    default:
      return true;
  }
}

// node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
function flowIndentCheck(indent, fc, onError) {
  if (fc?.type === "flow-collection") {
    const end = fc.end[0];
    if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
      const msg = "Flow end indicator should be more indented than parent";
      onError(end, "BAD_INDENT", msg, true);
    }
  }
}

// node_modules/yaml/browser/dist/compose/util-map-includes.js
function mapIncludes(ctx, items, search) {
  const { uniqueKeys } = ctx.options;
  if (uniqueKeys === false)
    return false;
  const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
  return items.some((pair) => isEqual(pair.key, search));
}

// node_modules/yaml/browser/dist/compose/resolve-block-map.js
var startColMsg = "All mapping items must start at the same column";
function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLMap;
  const map3 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  let offset = bm.offset;
  let commentEnd = null;
  for (const collItem of bm.items) {
    const { start, key, sep, value } = collItem;
    const keyProps = resolveProps(start, {
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: bm.indent,
      startOnNewline: true
    });
    const implicitKey = !keyProps.found;
    if (implicitKey) {
      if (key) {
        if (key.type === "block-seq")
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
        else if ("indent" in key && key.indent !== bm.indent)
          onError(offset, "BAD_INDENT", startColMsg);
      }
      if (!keyProps.anchor && !keyProps.tag && !sep) {
        commentEnd = keyProps.end;
        if (keyProps.comment) {
          if (map3.comment)
            map3.comment += "\n" + keyProps.comment;
          else
            map3.comment = keyProps.comment;
        }
        continue;
      }
      if (keyProps.newlineAfterProp || containsNewline(key)) {
        onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
      }
    } else if (keyProps.found?.indent !== bm.indent) {
      onError(offset, "BAD_INDENT", startColMsg);
    }
    ctx.atKey = true;
    const keyStart = keyProps.end;
    const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bm.indent, key, onError);
    ctx.atKey = false;
    if (mapIncludes(ctx, map3.items, keyNode))
      onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
    const valueProps = resolveProps(sep ?? [], {
      indicator: "map-value-ind",
      next: value,
      offset: keyNode.range[2],
      onError,
      parentIndent: bm.indent,
      startOnNewline: !key || key.type === "block-scalar"
    });
    offset = valueProps.end;
    if (valueProps.found) {
      if (implicitKey) {
        if (value?.type === "block-map" && !valueProps.hasNewline)
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
        if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
          onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, value, onError);
      offset = valueNode.range[2];
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map3.items.push(pair);
    } else {
      if (implicitKey)
        onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
      if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map3.items.push(pair);
    }
  }
  if (commentEnd && commentEnd < offset)
    onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
  map3.range = [bm.offset, offset, commentEnd ?? offset];
  return map3;
}

// node_modules/yaml/browser/dist/compose/resolve-block-seq.js
function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLSeq;
  const seq2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = bs.offset;
  let commentEnd = null;
  for (const { start, value } of bs.items) {
    const props = resolveProps(start, {
      indicator: "seq-item-ind",
      next: value,
      offset,
      onError,
      parentIndent: bs.indent,
      startOnNewline: true
    });
    if (!props.found) {
      if (props.anchor || props.tag || value) {
        if (value?.type === "block-seq")
          onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
        else
          onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
      } else {
        commentEnd = props.end;
        if (props.comment)
          seq2.comment = props.comment;
        continue;
      }
    }
    const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bs.indent, value, onError);
    offset = node.range[2];
    seq2.items.push(node);
  }
  seq2.range = [bs.offset, offset, commentEnd ?? offset];
  return seq2;
}

// node_modules/yaml/browser/dist/compose/resolve-end.js
function resolveEnd(end, offset, reqSpace, onError) {
  let comment = "";
  if (end) {
    let hasSpace = false;
    let sep = "";
    for (const token of end) {
      const { source, type } = token;
      switch (type) {
        case "space":
          hasSpace = true;
          break;
        case "comment": {
          if (reqSpace && !hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += sep + cb;
          sep = "";
          break;
        }
        case "newline":
          if (comment)
            sep += source;
          hasSpace = true;
          break;
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
      }
      offset += source.length;
    }
  }
  return { comment, offset };
}

// node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
var blockMsg = "Block collections are not allowed within flow collections";
var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
  const isMap2 = fc.start.source === "{";
  const fcName = isMap2 ? "flow map" : "flow sequence";
  const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
  const coll = new NodeClass(ctx.schema);
  coll.flow = true;
  const atRoot = ctx.atRoot;
  if (atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = fc.offset + fc.start.source.length;
  for (let i = 0; i < fc.items.length; ++i) {
    const collItem = fc.items[i];
    const { start, key, sep, value } = collItem;
    const props = resolveProps(start, {
      flow: fcName,
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: fc.indent,
      startOnNewline: false
    });
    if (!props.found) {
      if (!props.anchor && !props.tag && !sep && !value) {
        if (i === 0 && props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        else if (i < fc.items.length - 1)
          onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
        if (props.comment) {
          if (coll.comment)
            coll.comment += "\n" + props.comment;
          else
            coll.comment = props.comment;
        }
        offset = props.end;
        continue;
      }
      if (!isMap2 && ctx.options.strict && containsNewline(key))
        onError(
          key,
          // checked by containsNewline()
          "MULTILINE_IMPLICIT_KEY",
          "Implicit keys of flow sequence pairs need to be on a single line"
        );
    }
    if (i === 0) {
      if (props.comma)
        onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
    } else {
      if (!props.comma)
        onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
      if (props.comment) {
        let prevItemComment = "";
        loop: for (const st of start) {
          switch (st.type) {
            case "comma":
            case "space":
              break;
            case "comment":
              prevItemComment = st.source.substring(1);
              break loop;
            default:
              break loop;
          }
        }
        if (prevItemComment) {
          let prev = coll.items[coll.items.length - 1];
          if (isPair(prev))
            prev = prev.value ?? prev.key;
          if (prev.comment)
            prev.comment += "\n" + prevItemComment;
          else
            prev.comment = prevItemComment;
          props.comment = props.comment.substring(prevItemComment.length + 1);
        }
      }
    }
    if (!isMap2 && !sep && !props.found) {
      const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
      coll.items.push(valueNode);
      offset = valueNode.range[2];
      if (isBlock(value))
        onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
    } else {
      ctx.atKey = true;
      const keyStart = props.end;
      const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
      if (isBlock(key))
        onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
      ctx.atKey = false;
      const valueProps = resolveProps(sep ?? [], {
        flow: fcName,
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (valueProps.found) {
        if (!isMap2 && !props.found && ctx.options.strict) {
          if (sep)
            for (const st of sep) {
              if (st === valueProps.found)
                break;
              if (st.type === "newline") {
                onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                break;
              }
            }
          if (props.start < valueProps.found.offset - 1024)
            onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
        }
      } else if (value) {
        if ("source" in value && value.source?.[0] === ":")
          onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
        else
          onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
      if (valueNode) {
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      if (isMap2) {
        const map3 = coll;
        if (mapIncludes(ctx, map3.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        map3.items.push(pair);
      } else {
        const map3 = new YAMLMap(ctx.schema);
        map3.flow = true;
        map3.items.push(pair);
        const endRange = (valueNode ?? keyNode).range;
        map3.range = [keyNode.range[0], endRange[1], endRange[2]];
        coll.items.push(map3);
      }
      offset = valueNode ? valueNode.range[2] : valueProps.end;
    }
  }
  const expectedEnd = isMap2 ? "}" : "]";
  const [ce, ...ee] = fc.end;
  let cePos = offset;
  if (ce?.source === expectedEnd)
    cePos = ce.offset + ce.source.length;
  else {
    const name = fcName[0].toUpperCase() + fcName.substring(1);
    const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
    onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
    if (ce && ce.source.length !== 1)
      ee.unshift(ce);
  }
  if (ee.length > 0) {
    const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
    if (end.comment) {
      if (coll.comment)
        coll.comment += "\n" + end.comment;
      else
        coll.comment = end.comment;
    }
    coll.range = [fc.offset, cePos, end.offset];
  } else {
    coll.range = [fc.offset, cePos, cePos];
  }
  return coll;
}

// node_modules/yaml/browser/dist/compose/compose-collection.js
function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
  const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
  const Coll = coll.constructor;
  if (tagName === "!" || tagName === Coll.tagName) {
    coll.tag = Coll.tagName;
    return coll;
  }
  if (tagName)
    coll.tag = tagName;
  return coll;
}
function composeCollection(CN2, ctx, token, props, onError) {
  const tagToken = props.tag;
  const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
  if (token.type === "block-seq") {
    const { anchor, newlineAfterProp: nl } = props;
    const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
    if (lastProp && (!nl || nl.offset < lastProp.offset)) {
      const message = "Missing newline after block sequence props";
      onError(lastProp, "MISSING_CHAR", message);
    }
  }
  const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
  if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
    return resolveCollection(CN2, ctx, token, onError, tagName);
  }
  let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
  if (!tag) {
    const kt = ctx.schema.knownTags[tagName];
    if (kt?.collection === expType) {
      ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
      tag = kt;
    } else {
      if (kt) {
        onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
      } else {
        onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
      }
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
  }
  const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
  const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
  const node = isNode(res) ? res : new Scalar(res);
  node.range = coll.range;
  node.tag = tagName;
  if (tag?.format)
    node.format = tag.format;
  return node;
}

// node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
function resolveBlockScalar(ctx, scalar, onError) {
  const start = scalar.offset;
  const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
  if (!header)
    return { value: "", type: null, comment: "", range: [start, start, start] };
  const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
  const lines = scalar.source ? splitLines(scalar.source) : [];
  let chompStart = lines.length;
  for (let i = lines.length - 1; i >= 0; --i) {
    const content = lines[i][1];
    if (content === "" || content === "\r")
      chompStart = i;
    else
      break;
  }
  if (chompStart === 0) {
    const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
    let end2 = start + header.length;
    if (scalar.source)
      end2 += scalar.source.length;
    return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
  }
  let trimIndent = scalar.indent + header.indent;
  let offset = scalar.offset + header.length;
  let contentStart = 0;
  for (let i = 0; i < chompStart; ++i) {
    const [indent, content] = lines[i];
    if (content === "" || content === "\r") {
      if (header.indent === 0 && indent.length > trimIndent)
        trimIndent = indent.length;
    } else {
      if (indent.length < trimIndent) {
        const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
        onError(offset + indent.length, "MISSING_CHAR", message);
      }
      if (header.indent === 0)
        trimIndent = indent.length;
      contentStart = i;
      if (trimIndent === 0 && !ctx.atRoot) {
        const message = "Block scalar values in collections must be indented";
        onError(offset, "BAD_INDENT", message);
      }
      break;
    }
    offset += indent.length + content.length + 1;
  }
  for (let i = lines.length - 1; i >= chompStart; --i) {
    if (lines[i][0].length > trimIndent)
      chompStart = i + 1;
  }
  let value = "";
  let sep = "";
  let prevMoreIndented = false;
  for (let i = 0; i < contentStart; ++i)
    value += lines[i][0].slice(trimIndent) + "\n";
  for (let i = contentStart; i < chompStart; ++i) {
    let [indent, content] = lines[i];
    offset += indent.length + content.length + 1;
    const crlf = content[content.length - 1] === "\r";
    if (crlf)
      content = content.slice(0, -1);
    if (content && indent.length < trimIndent) {
      const src = header.indent ? "explicit indentation indicator" : "first line";
      const message = `Block scalar lines must not be less indented than their ${src}`;
      onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
      indent = "";
    }
    if (type === Scalar.BLOCK_LITERAL) {
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
    } else if (indent.length > trimIndent || content[0] === "	") {
      if (sep === " ")
        sep = "\n";
      else if (!prevMoreIndented && sep === "\n")
        sep = "\n\n";
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
      prevMoreIndented = true;
    } else if (content === "") {
      if (sep === "\n")
        value += "\n";
      else
        sep = "\n";
    } else {
      value += sep + content;
      sep = " ";
      prevMoreIndented = false;
    }
  }
  switch (header.chomp) {
    case "-":
      break;
    case "+":
      for (let i = chompStart; i < lines.length; ++i)
        value += "\n" + lines[i][0].slice(trimIndent);
      if (value[value.length - 1] !== "\n")
        value += "\n";
      break;
    default:
      value += "\n";
  }
  const end = start + header.length + scalar.source.length;
  return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
  if (props[0].type !== "block-scalar-header") {
    onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
    return null;
  }
  const { source } = props[0];
  const mode = source[0];
  let indent = 0;
  let chomp = "";
  let error2 = -1;
  for (let i = 1; i < source.length; ++i) {
    const ch = source[i];
    if (!chomp && (ch === "-" || ch === "+"))
      chomp = ch;
    else {
      const n = Number(ch);
      if (!indent && n)
        indent = n;
      else if (error2 === -1)
        error2 = offset + i;
    }
  }
  if (error2 !== -1)
    onError(error2, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
  let hasSpace = false;
  let comment = "";
  let length = source.length;
  for (let i = 1; i < props.length; ++i) {
    const token = props[i];
    switch (token.type) {
      case "space":
        hasSpace = true;
      // fallthrough
      case "newline":
        length += token.source.length;
        break;
      case "comment":
        if (strict && !hasSpace) {
          const message = "Comments must be separated from other tokens by white space characters";
          onError(token, "MISSING_CHAR", message);
        }
        length += token.source.length;
        comment = token.source.substring(1);
        break;
      case "error":
        onError(token, "UNEXPECTED_TOKEN", token.message);
        length += token.source.length;
        break;
      /* istanbul ignore next should not happen */
      default: {
        const message = `Unexpected token in block scalar header: ${token.type}`;
        onError(token, "UNEXPECTED_TOKEN", message);
        const ts = token.source;
        if (ts && typeof ts === "string")
          length += ts.length;
      }
    }
  }
  return { mode, indent, chomp, comment, length };
}
function splitLines(source) {
  const split = source.split(/\n( *)/);
  const first = split[0];
  const m = first.match(/^( *)/);
  const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
  const lines = [line0];
  for (let i = 1; i < split.length; i += 2)
    lines.push([split[i], split[i + 1]]);
  return lines;
}

// node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
function resolveFlowScalar(scalar, strict, onError) {
  const { offset, type, source, end } = scalar;
  let _type;
  let value;
  const _onError = (rel, code2, msg) => onError(offset + rel, code2, msg);
  switch (type) {
    case "scalar":
      _type = Scalar.PLAIN;
      value = plainValue(source, _onError);
      break;
    case "single-quoted-scalar":
      _type = Scalar.QUOTE_SINGLE;
      value = singleQuotedValue(source, _onError);
      break;
    case "double-quoted-scalar":
      _type = Scalar.QUOTE_DOUBLE;
      value = doubleQuotedValue(source, _onError);
      break;
    /* istanbul ignore next should not happen */
    default:
      onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
      return {
        value: "",
        type: null,
        comment: "",
        range: [offset, offset + source.length, offset + source.length]
      };
  }
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, strict, onError);
  return {
    value,
    type: _type,
    comment: re.comment,
    range: [offset, valueEnd, re.offset]
  };
}
function plainValue(source, onError) {
  let badChar = "";
  switch (source[0]) {
    /* istanbul ignore next should not happen */
    case "	":
      badChar = "a tab character";
      break;
    case ",":
      badChar = "flow indicator character ,";
      break;
    case "%":
      badChar = "directive indicator character %";
      break;
    case "|":
    case ">": {
      badChar = `block scalar indicator ${source[0]}`;
      break;
    }
    case "@":
    case "`": {
      badChar = `reserved character ${source[0]}`;
      break;
    }
  }
  if (badChar)
    onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
  return unfoldLines(source);
}
function singleQuotedValue(source, onError) {
  if (source[source.length - 1] !== "'" || source.length === 1)
    onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
  return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function unfoldLines(source) {
  const line = /(.*?)\r?\n/sy;
  let match = line.exec(source);
  if (!match)
    return source;
  let trimEnd, trimBoth;
  try {
    trimEnd = new RegExp("(?<![ 	])[ 	]+$");
    trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
  } catch {
    trimEnd = /[ \t]+$/;
    trimBoth = /^[ \t]+|[ \t]+$/g;
  }
  let res = match[1].replace(trimEnd, "");
  let sep = " ";
  let pos = line.lastIndex;
  while (match = line.exec(source)) {
    const lm = match[1].replace(trimBoth, "");
    if (lm === "") {
      if (sep === "\n")
        res += sep;
      else
        sep = "\n";
    } else {
      res += sep + lm;
      sep = " ";
    }
    pos = line.lastIndex;
  }
  const last = /[ \t]*(.*)/sy;
  last.lastIndex = pos;
  match = last.exec(source);
  return res + sep + (match?.[1] ?? "");
}
function doubleQuotedValue(source, onError) {
  let res = "";
  for (let i = 1; i < source.length - 1; ++i) {
    const ch = source[i];
    if (ch === "\r" && source[i + 1] === "\n")
      continue;
    if (ch === "\n") {
      const { fold, offset } = foldNewline(source, i);
      res += fold;
      i = offset;
    } else if (ch === "\\") {
      let next = source[++i];
      const cc = escapeCodes[next];
      if (cc)
        res += cc;
      else if (next === "\n") {
        next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "\r" && source[i + 1] === "\n") {
        next = source[++i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "x" || next === "u" || next === "U") {
        const length = next === "x" ? 2 : next === "u" ? 4 : 8;
        res += parseCharCode(source, i + 1, length, onError);
        i += length;
      } else {
        const raw = source.substr(i - 1, 2);
        onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        res += raw;
      }
    } else if (ch === " " || ch === "	") {
      const wsStart = i;
      let next = source[i + 1];
      while (next === " " || next === "	")
        next = source[++i + 1];
      if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
        res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
    } else {
      res += ch;
    }
  }
  if (source[source.length - 1] !== '"' || source.length === 1)
    onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
  return res;
}
function foldNewline(source, offset) {
  let fold = "";
  let ch = source[offset + 1];
  while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
    if (ch === "\r" && source[offset + 2] !== "\n")
      break;
    if (ch === "\n")
      fold += "\n";
    offset += 1;
    ch = source[offset + 1];
  }
  if (!fold)
    fold = " ";
  return { fold, offset };
}
var escapeCodes = {
  "0": "\0",
  // null character
  a: "\x07",
  // bell character
  b: "\b",
  // backspace
  e: "\x1B",
  // escape character
  f: "\f",
  // form feed
  n: "\n",
  // line feed
  r: "\r",
  // carriage return
  t: "	",
  // horizontal tab
  v: "\v",
  // vertical tab
  N: "\x85",
  // Unicode next line
  _: "\xA0",
  // Unicode non-breaking space
  L: "\u2028",
  // Unicode line separator
  P: "\u2029",
  // Unicode paragraph separator
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  "	": "	"
};
function parseCharCode(source, offset, length, onError) {
  const cc = source.substr(offset, length);
  const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
  const code2 = ok ? parseInt(cc, 16) : NaN;
  try {
    return String.fromCodePoint(code2);
  } catch {
    const raw = source.substr(offset - 2, length + 2);
    onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
    return raw;
  }
}

// node_modules/yaml/browser/dist/compose/compose-scalar.js
function composeScalar(ctx, token, tagToken, onError) {
  const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
  const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
  let tag;
  if (ctx.options.stringKeys && ctx.atKey) {
    tag = ctx.schema[SCALAR];
  } else if (tagName)
    tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
  else if (token.type === "scalar")
    tag = findScalarTagByTest(ctx, value, token, onError);
  else
    tag = ctx.schema[SCALAR];
  let scalar;
  try {
    const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
    scalar = isScalar(res) ? res : new Scalar(res);
  } catch (error2) {
    const msg = error2 instanceof Error ? error2.message : String(error2);
    onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
    scalar = new Scalar(value);
  }
  scalar.range = range;
  scalar.source = value;
  if (type)
    scalar.type = type;
  if (tagName)
    scalar.tag = tagName;
  if (tag.format)
    scalar.format = tag.format;
  if (comment)
    scalar.comment = comment;
  return scalar;
}
function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
  if (tagName === "!")
    return schema4[SCALAR];
  const matchWithTest = [];
  for (const tag of schema4.tags) {
    if (!tag.collection && tag.tag === tagName) {
      if (tag.default && tag.test)
        matchWithTest.push(tag);
      else
        return tag;
    }
  }
  for (const tag of matchWithTest)
    if (tag.test?.test(value))
      return tag;
  const kt = schema4.knownTags[tagName];
  if (kt && !kt.collection) {
    schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
    return kt;
  }
  onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
  return schema4[SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
  const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
  if (schema4.compat) {
    const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
    if (tag.tag !== compat.tag) {
      const ts = directives.tagString(tag.tag);
      const cs = directives.tagString(compat.tag);
      const msg = `Value may be parsed as either ${ts} or ${cs}`;
      onError(token, "TAG_RESOLVE_FAILED", msg, true);
    }
  }
  return tag;
}

// node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
function emptyScalarPosition(offset, before, pos) {
  if (before) {
    pos ?? (pos = before.length);
    for (let i = pos - 1; i >= 0; --i) {
      let st = before[i];
      switch (st.type) {
        case "space":
        case "comment":
        case "newline":
          offset -= st.source.length;
          continue;
      }
      st = before[++i];
      while (st?.type === "space") {
        offset += st.source.length;
        st = before[++i];
      }
      break;
    }
  }
  return offset;
}

// node_modules/yaml/browser/dist/compose/compose-node.js
var CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
  const atKey = ctx.atKey;
  const { spaceBefore, comment, anchor, tag } = props;
  let node;
  let isSrcToken = true;
  switch (token.type) {
    case "alias":
      node = composeAlias(ctx, token, onError);
      if (anchor || tag)
        onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
      break;
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "block-scalar":
      node = composeScalar(ctx, token, tag, onError);
      if (anchor)
        node.anchor = anchor.source.substring(1);
      break;
    case "block-map":
    case "block-seq":
    case "flow-collection":
      try {
        node = composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
      } catch (error2) {
        const message = error2 instanceof Error ? error2.message : String(error2);
        onError(token, "RESOURCE_EXHAUSTION", message);
      }
      break;
    default: {
      const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
      onError(token, "UNEXPECTED_TOKEN", message);
      isSrcToken = false;
    }
  }
  node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
  if (anchor && node.anchor === "")
    onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
    const msg = "With stringKeys, all keys must be strings";
    onError(tag ?? token, "NON_STRING_KEY", msg);
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    if (token.type === "scalar" && token.source === "")
      node.comment = comment;
    else
      node.commentBefore = comment;
  }
  if (ctx.options.keepSourceTokens && isSrcToken)
    node.srcToken = token;
  return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
  const token = {
    type: "scalar",
    offset: emptyScalarPosition(offset, before, pos),
    indent: -1,
    source: ""
  };
  const node = composeScalar(ctx, token, tag, onError);
  if (anchor) {
    node.anchor = anchor.source.substring(1);
    if (node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    node.comment = comment;
    node.range[2] = end;
  }
  return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
  const alias = new Alias(source.substring(1));
  if (alias.source === "")
    onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
  if (alias.source.endsWith(":"))
    onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, options.strict, onError);
  alias.range = [offset, valueEnd, re.offset];
  if (re.comment)
    alias.comment = re.comment;
  return alias;
}

// node_modules/yaml/browser/dist/compose/compose-doc.js
function composeDoc(options, directives, { offset, start, value, end }, onError) {
  const opts = Object.assign({ _directives: directives }, options);
  const doc = new Document(void 0, opts);
  const ctx = {
    atKey: false,
    atRoot: true,
    directives: doc.directives,
    options: doc.options,
    schema: doc.schema
  };
  const props = resolveProps(start, {
    indicator: "doc-start",
    next: value ?? end?.[0],
    offset,
    onError,
    parentIndent: 0,
    startOnNewline: true
  });
  if (props.found) {
    doc.directives.docStart = true;
    if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
      onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
  }
  doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
  const contentEnd = doc.contents.range[2];
  const re = resolveEnd(end, contentEnd, false, onError);
  if (re.comment)
    doc.comment = re.comment;
  doc.range = [offset, contentEnd, re.offset];
  return doc;
}

// node_modules/yaml/browser/dist/compose/composer.js
function getErrorPos(src) {
  if (typeof src === "number")
    return [src, src + 1];
  if (Array.isArray(src))
    return src.length === 2 ? src : [src[0], src[1]];
  const { offset, source } = src;
  return [offset, offset + (typeof source === "string" ? source.length : 1)];
}
function parsePrelude(prelude) {
  let comment = "";
  let atComment = false;
  let afterEmptyLine = false;
  for (let i = 0; i < prelude.length; ++i) {
    const source = prelude[i];
    switch (source[0]) {
      case "#":
        comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
        atComment = true;
        afterEmptyLine = false;
        break;
      case "%":
        if (prelude[i + 1]?.[0] !== "#")
          i += 1;
        atComment = false;
        break;
      default:
        if (!atComment)
          afterEmptyLine = true;
        atComment = false;
    }
  }
  return { comment, afterEmptyLine };
}
var Composer = class {
  constructor(options = {}) {
    this.doc = null;
    this.atDirectives = false;
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
    this.onError = (source, code2, message, warning) => {
      const pos = getErrorPos(source);
      if (warning)
        this.warnings.push(new YAMLWarning(pos, code2, message));
      else
        this.errors.push(new YAMLParseError(pos, code2, message));
    };
    this.directives = new Directives({ version: options.version || "1.2" });
    this.options = options;
  }
  decorate(doc, afterDoc) {
    const { comment, afterEmptyLine } = parsePrelude(this.prelude);
    if (comment) {
      const dc = doc.contents;
      if (afterDoc) {
        doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
      } else if (afterEmptyLine || doc.directives.docStart || !dc) {
        doc.commentBefore = comment;
      } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
        let it = dc.items[0];
        if (isPair(it))
          it = it.key;
        const cb = it.commentBefore;
        it.commentBefore = cb ? `${comment}
${cb}` : comment;
      } else {
        const cb = dc.commentBefore;
        dc.commentBefore = cb ? `${comment}
${cb}` : comment;
      }
    }
    if (afterDoc) {
      for (let i = 0; i < this.errors.length; ++i)
        doc.errors.push(this.errors[i]);
      for (let i = 0; i < this.warnings.length; ++i)
        doc.warnings.push(this.warnings[i]);
    } else {
      doc.errors = this.errors;
      doc.warnings = this.warnings;
    }
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
  }
  /**
   * Current stream status information.
   *
   * Mostly useful at the end of input for an empty stream.
   */
  streamInfo() {
    return {
      comment: parsePrelude(this.prelude).comment,
      directives: this.directives,
      errors: this.errors,
      warnings: this.warnings
    };
  }
  /**
   * Compose tokens into documents.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *compose(tokens, forceDoc = false, endOffset = -1) {
    for (const token of tokens)
      yield* this.next(token);
    yield* this.end(forceDoc, endOffset);
  }
  /** Advance the composer by one CST token. */
  *next(token) {
    switch (token.type) {
      case "directive":
        this.directives.add(token.source, (offset, message, warning) => {
          const pos = getErrorPos(token);
          pos[0] += offset;
          this.onError(pos, "BAD_DIRECTIVE", message, warning);
        });
        this.prelude.push(token.source);
        this.atDirectives = true;
        break;
      case "document": {
        const doc = composeDoc(this.options, this.directives, token, this.onError);
        if (this.atDirectives && !doc.directives.docStart)
          this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
        this.decorate(doc, false);
        if (this.doc)
          yield this.doc;
        this.doc = doc;
        this.atDirectives = false;
        break;
      }
      case "byte-order-mark":
      case "space":
        break;
      case "comment":
      case "newline":
        this.prelude.push(token.source);
        break;
      case "error": {
        const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
        const error2 = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
        if (this.atDirectives || !this.doc)
          this.errors.push(error2);
        else
          this.doc.errors.push(error2);
        break;
      }
      case "doc-end": {
        if (!this.doc) {
          const msg = "Unexpected doc-end without preceding document";
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
          break;
        }
        this.doc.directives.docEnd = true;
        const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
        this.decorate(this.doc, true);
        if (end.comment) {
          const dc = this.doc.comment;
          this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
        }
        this.doc.range[2] = end.offset;
        break;
      }
      default:
        this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
    }
  }
  /**
   * Call at end of input to yield any remaining document.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *end(forceDoc = false, endOffset = -1) {
    if (this.doc) {
      this.decorate(this.doc, true);
      yield this.doc;
      this.doc = null;
    } else if (forceDoc) {
      const opts = Object.assign({ _directives: this.directives }, this.options);
      const doc = new Document(void 0, opts);
      if (this.atDirectives)
        this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
      doc.range = [0, endOffset, endOffset];
      this.decorate(doc, false);
      yield doc;
    }
  }
};

// node_modules/yaml/browser/dist/parse/cst-visit.js
var BREAK2 = /* @__PURE__ */ Symbol("break visit");
var SKIP2 = /* @__PURE__ */ Symbol("skip children");
var REMOVE2 = /* @__PURE__ */ Symbol("remove item");
function visit2(cst, visitor) {
  if ("type" in cst && cst.type === "document")
    cst = { start: cst.start, value: cst.value };
  _visit(Object.freeze([]), cst, visitor);
}
visit2.BREAK = BREAK2;
visit2.SKIP = SKIP2;
visit2.REMOVE = REMOVE2;
visit2.itemAtPath = (cst, path) => {
  let item = cst;
  for (const [field, index] of path) {
    const tok = item?.[field];
    if (tok && "items" in tok) {
      item = tok.items[index];
    } else
      return void 0;
  }
  return item;
};
visit2.parentCollection = (cst, path) => {
  const parent = visit2.itemAtPath(cst, path.slice(0, -1));
  const field = path[path.length - 1][0];
  const coll = parent?.[field];
  if (coll && "items" in coll)
    return coll;
  throw new Error("Parent collection not found");
};
function _visit(path, item, visitor) {
  let ctrl = visitor(item, path);
  if (typeof ctrl === "symbol")
    return ctrl;
  for (const field of ["key", "value"]) {
    const token = item[field];
    if (token && "items" in token) {
      for (let i = 0; i < token.items.length; ++i) {
        const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK2)
          return BREAK2;
        else if (ci === REMOVE2) {
          token.items.splice(i, 1);
          i -= 1;
        }
      }
      if (typeof ctrl === "function" && field === "key")
        ctrl = ctrl(item, path);
    }
  }
  return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
}

// node_modules/yaml/browser/dist/parse/cst.js
var BOM = "\uFEFF";
var DOCUMENT = "";
var FLOW_END = "";
var SCALAR2 = "";
function tokenType(source) {
  switch (source) {
    case BOM:
      return "byte-order-mark";
    case DOCUMENT:
      return "doc-mode";
    case FLOW_END:
      return "flow-error-end";
    case SCALAR2:
      return "scalar";
    case "---":
      return "doc-start";
    case "...":
      return "doc-end";
    case "":
    case "\n":
    case "\r\n":
      return "newline";
    case "-":
      return "seq-item-ind";
    case "?":
      return "explicit-key-ind";
    case ":":
      return "map-value-ind";
    case "{":
      return "flow-map-start";
    case "}":
      return "flow-map-end";
    case "[":
      return "flow-seq-start";
    case "]":
      return "flow-seq-end";
    case ",":
      return "comma";
  }
  switch (source[0]) {
    case " ":
    case "	":
      return "space";
    case "#":
      return "comment";
    case "%":
      return "directive-line";
    case "*":
      return "alias";
    case "&":
      return "anchor";
    case "!":
      return "tag";
    case "'":
      return "single-quoted-scalar";
    case '"':
      return "double-quoted-scalar";
    case "|":
    case ">":
      return "block-scalar-header";
  }
  return null;
}

// node_modules/yaml/browser/dist/parse/lexer.js
function isEmpty(ch) {
  switch (ch) {
    case void 0:
    case " ":
    case "\n":
    case "\r":
    case "	":
      return true;
    default:
      return false;
  }
}
var hexDigits = new Set("0123456789ABCDEFabcdef");
var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
var flowIndicatorChars = new Set(",[]{}");
var invalidAnchorChars = new Set(" ,[]{}\n\r	");
var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
var Lexer = class {
  constructor() {
    this.atEnd = false;
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    this.buffer = "";
    this.flowKey = false;
    this.flowLevel = 0;
    this.indentNext = 0;
    this.indentValue = 0;
    this.lineEndPos = null;
    this.next = null;
    this.pos = 0;
  }
  /**
   * Generate YAML tokens from the `source` string. If `incomplete`,
   * a part of the last line may be left as a buffer for the next call.
   *
   * @returns A generator of lexical tokens
   */
  *lex(source, incomplete = false) {
    if (source) {
      if (typeof source !== "string")
        throw TypeError("source is not a string");
      this.buffer = this.buffer ? this.buffer + source : source;
      this.lineEndPos = null;
    }
    this.atEnd = !incomplete;
    let next = this.next ?? "stream";
    while (next && (incomplete || this.hasChars(1)))
      next = yield* this.parseNext(next);
  }
  atLineEnd() {
    let i = this.pos;
    let ch = this.buffer[i];
    while (ch === " " || ch === "	")
      ch = this.buffer[++i];
    if (!ch || ch === "#" || ch === "\n")
      return true;
    if (ch === "\r")
      return this.buffer[i + 1] === "\n";
    return false;
  }
  charAt(n) {
    return this.buffer[this.pos + n];
  }
  continueScalar(offset) {
    let ch = this.buffer[offset];
    if (this.indentNext > 0) {
      let indent = 0;
      while (ch === " ")
        ch = this.buffer[++indent + offset];
      if (ch === "\r") {
        const next = this.buffer[indent + offset + 1];
        if (next === "\n" || !next && !this.atEnd)
          return offset + indent + 1;
      }
      return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
    }
    if (ch === "-" || ch === ".") {
      const dt = this.buffer.substr(offset, 3);
      if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
        return -1;
    }
    return offset;
  }
  getLine() {
    let end = this.lineEndPos;
    if (typeof end !== "number" || end !== -1 && end < this.pos) {
      end = this.buffer.indexOf("\n", this.pos);
      this.lineEndPos = end;
    }
    if (end === -1)
      return this.atEnd ? this.buffer.substring(this.pos) : null;
    if (this.buffer[end - 1] === "\r")
      end -= 1;
    return this.buffer.substring(this.pos, end);
  }
  hasChars(n) {
    return this.pos + n <= this.buffer.length;
  }
  setNext(state) {
    this.buffer = this.buffer.substring(this.pos);
    this.pos = 0;
    this.lineEndPos = null;
    this.next = state;
    return null;
  }
  peek(n) {
    return this.buffer.substr(this.pos, n);
  }
  *parseNext(next) {
    switch (next) {
      case "stream":
        return yield* this.parseStream();
      case "line-start":
        return yield* this.parseLineStart();
      case "block-start":
        return yield* this.parseBlockStart();
      case "doc":
        return yield* this.parseDocument();
      case "flow":
        return yield* this.parseFlowCollection();
      case "quoted-scalar":
        return yield* this.parseQuotedScalar();
      case "block-scalar":
        return yield* this.parseBlockScalar();
      case "plain-scalar":
        return yield* this.parsePlainScalar();
    }
  }
  *parseStream() {
    let line = this.getLine();
    if (line === null)
      return this.setNext("stream");
    if (line[0] === BOM) {
      yield* this.pushCount(1);
      line = line.substring(1);
    }
    if (line[0] === "%") {
      let dirEnd = line.length;
      let cs = line.indexOf("#");
      while (cs !== -1) {
        const ch = line[cs - 1];
        if (ch === " " || ch === "	") {
          dirEnd = cs - 1;
          break;
        } else {
          cs = line.indexOf("#", cs + 1);
        }
      }
      while (true) {
        const ch = line[dirEnd - 1];
        if (ch === " " || ch === "	")
          dirEnd -= 1;
        else
          break;
      }
      const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
      yield* this.pushCount(line.length - n);
      this.pushNewline();
      return "stream";
    }
    if (this.atLineEnd()) {
      const sp = yield* this.pushSpaces(true);
      yield* this.pushCount(line.length - sp);
      yield* this.pushNewline();
      return "stream";
    }
    yield DOCUMENT;
    return yield* this.parseLineStart();
  }
  *parseLineStart() {
    const ch = this.charAt(0);
    if (!ch && !this.atEnd)
      return this.setNext("line-start");
    if (ch === "-" || ch === ".") {
      if (!this.atEnd && !this.hasChars(4))
        return this.setNext("line-start");
      const s = this.peek(3);
      if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
        yield* this.pushCount(3);
        this.indentValue = 0;
        this.indentNext = 0;
        return s === "---" ? "doc" : "stream";
      }
    }
    this.indentValue = yield* this.pushSpaces(false);
    if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
      this.indentNext = this.indentValue;
    return yield* this.parseBlockStart();
  }
  *parseBlockStart() {
    const [ch0, ch1] = this.peek(2);
    if (!ch1 && !this.atEnd)
      return this.setNext("block-start");
    if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
      const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
      this.indentNext = this.indentValue + 1;
      this.indentValue += n;
      return "block-start";
    }
    return "doc";
  }
  *parseDocument() {
    yield* this.pushSpaces(true);
    const line = this.getLine();
    if (line === null)
      return this.setNext("doc");
    let n = yield* this.pushIndicators();
    switch (line[n]) {
      case "#":
        yield* this.pushCount(line.length - n);
      // fallthrough
      case void 0:
        yield* this.pushNewline();
        return yield* this.parseLineStart();
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel = 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        return "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "doc";
      case '"':
      case "'":
        return yield* this.parseQuotedScalar();
      case "|":
      case ">":
        n += yield* this.parseBlockScalarHeader();
        n += yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - n);
        yield* this.pushNewline();
        return yield* this.parseBlockScalar();
      default:
        return yield* this.parsePlainScalar();
    }
  }
  *parseFlowCollection() {
    let nl, sp;
    let indent = -1;
    do {
      nl = yield* this.pushNewline();
      if (nl > 0) {
        sp = yield* this.pushSpaces(false);
        this.indentValue = indent = sp;
      } else {
        sp = 0;
      }
      sp += yield* this.pushSpaces(true);
    } while (nl + sp > 0);
    const line = this.getLine();
    if (line === null)
      return this.setNext("flow");
    if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
      const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
      if (!atFlowEndMarker) {
        this.flowLevel = 0;
        yield FLOW_END;
        return yield* this.parseLineStart();
      }
    }
    let n = 0;
    while (line[n] === ",") {
      n += yield* this.pushCount(1);
      n += yield* this.pushSpaces(true);
      this.flowKey = false;
    }
    n += yield* this.pushIndicators();
    switch (line[n]) {
      case void 0:
        return "flow";
      case "#":
        yield* this.pushCount(line.length - n);
        return "flow";
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel += 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        this.flowKey = true;
        this.flowLevel -= 1;
        return this.flowLevel ? "flow" : "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "flow";
      case '"':
      case "'":
        this.flowKey = true;
        return yield* this.parseQuotedScalar();
      case ":": {
        const next = this.charAt(1);
        if (this.flowKey || isEmpty(next) || next === ",") {
          this.flowKey = false;
          yield* this.pushCount(1);
          yield* this.pushSpaces(true);
          return "flow";
        }
      }
      // fallthrough
      default:
        this.flowKey = false;
        return yield* this.parsePlainScalar();
    }
  }
  *parseQuotedScalar() {
    const quote = this.charAt(0);
    let end = this.buffer.indexOf(quote, this.pos + 1);
    if (quote === "'") {
      while (end !== -1 && this.buffer[end + 1] === "'")
        end = this.buffer.indexOf("'", end + 2);
    } else {
      while (end !== -1) {
        let n = 0;
        while (this.buffer[end - 1 - n] === "\\")
          n += 1;
        if (n % 2 === 0)
          break;
        end = this.buffer.indexOf('"', end + 1);
      }
    }
    const qb = this.buffer.substring(0, end);
    let nl = qb.indexOf("\n", this.pos);
    if (nl !== -1) {
      while (nl !== -1) {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = qb.indexOf("\n", cs);
      }
      if (nl !== -1) {
        end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
      }
    }
    if (end === -1) {
      if (!this.atEnd)
        return this.setNext("quoted-scalar");
      end = this.buffer.length;
    }
    yield* this.pushToIndex(end + 1, false);
    return this.flowLevel ? "flow" : "doc";
  }
  *parseBlockScalarHeader() {
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    let i = this.pos;
    while (true) {
      const ch = this.buffer[++i];
      if (ch === "+")
        this.blockScalarKeep = true;
      else if (ch > "0" && ch <= "9")
        this.blockScalarIndent = Number(ch) - 1;
      else if (ch !== "-")
        break;
    }
    return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
  }
  *parseBlockScalar() {
    let nl = this.pos - 1;
    let indent = 0;
    let ch;
    loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
      switch (ch) {
        case " ":
          indent += 1;
          break;
        case "\n":
          nl = i2;
          indent = 0;
          break;
        case "\r": {
          const next = this.buffer[i2 + 1];
          if (!next && !this.atEnd)
            return this.setNext("block-scalar");
          if (next === "\n")
            break;
        }
        // fallthrough
        default:
          break loop;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("block-scalar");
    if (indent >= this.indentNext) {
      if (this.blockScalarIndent === -1)
        this.indentNext = indent;
      else {
        this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
      }
      do {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = this.buffer.indexOf("\n", cs);
      } while (nl !== -1);
      if (nl === -1) {
        if (!this.atEnd)
          return this.setNext("block-scalar");
        nl = this.buffer.length;
      }
    }
    let i = nl + 1;
    ch = this.buffer[i];
    while (ch === " ")
      ch = this.buffer[++i];
    if (ch === "	") {
      while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
        ch = this.buffer[++i];
      nl = i - 1;
    } else if (!this.blockScalarKeep) {
      do {
        let i2 = nl - 1;
        let ch2 = this.buffer[i2];
        if (ch2 === "\r")
          ch2 = this.buffer[--i2];
        const lastChar = i2;
        while (ch2 === " ")
          ch2 = this.buffer[--i2];
        if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
          nl = i2;
        else
          break;
      } while (true);
    }
    yield SCALAR2;
    yield* this.pushToIndex(nl + 1, true);
    return yield* this.parseLineStart();
  }
  *parsePlainScalar() {
    const inFlow = this.flowLevel > 0;
    let end = this.pos - 1;
    let i = this.pos - 1;
    let ch;
    while (ch = this.buffer[++i]) {
      if (ch === ":") {
        const next = this.buffer[i + 1];
        if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
          break;
        end = i;
      } else if (isEmpty(ch)) {
        let next = this.buffer[i + 1];
        if (ch === "\r") {
          if (next === "\n") {
            i += 1;
            ch = "\n";
            next = this.buffer[i + 1];
          } else
            end = i;
        }
        if (next === "#" || inFlow && flowIndicatorChars.has(next))
          break;
        if (ch === "\n") {
          const cs = this.continueScalar(i + 1);
          if (cs === -1)
            break;
          i = Math.max(i, cs - 2);
        }
      } else {
        if (inFlow && flowIndicatorChars.has(ch))
          break;
        end = i;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("plain-scalar");
    yield SCALAR2;
    yield* this.pushToIndex(end + 1, true);
    return inFlow ? "flow" : "doc";
  }
  *pushCount(n) {
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos += n;
      return n;
    }
    return 0;
  }
  *pushToIndex(i, allowEmpty) {
    const s = this.buffer.slice(this.pos, i);
    if (s) {
      yield s;
      this.pos += s.length;
      return s.length;
    } else if (allowEmpty)
      yield "";
    return 0;
  }
  *pushIndicators() {
    let n = 0;
    loop: while (true) {
      switch (this.charAt(0)) {
        case "!":
          n += yield* this.pushTag();
          n += yield* this.pushSpaces(true);
          continue loop;
        case "&":
          n += yield* this.pushUntil(isNotAnchorChar);
          n += yield* this.pushSpaces(true);
          continue loop;
        case "-":
        // this is an error
        case "?":
        // this is an error outside flow collections
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            continue loop;
          }
        }
      }
      break loop;
    }
    return n;
  }
  *pushTag() {
    if (this.charAt(1) === "<") {
      let i = this.pos + 2;
      let ch = this.buffer[i];
      while (!isEmpty(ch) && ch !== ">")
        ch = this.buffer[++i];
      return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
    } else {
      let i = this.pos + 1;
      let ch = this.buffer[i];
      while (ch) {
        if (tagChars.has(ch))
          ch = this.buffer[++i];
        else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
          ch = this.buffer[i += 3];
        } else
          break;
      }
      return yield* this.pushToIndex(i, false);
    }
  }
  *pushNewline() {
    const ch = this.buffer[this.pos];
    if (ch === "\n")
      return yield* this.pushCount(1);
    else if (ch === "\r" && this.charAt(1) === "\n")
      return yield* this.pushCount(2);
    else
      return 0;
  }
  *pushSpaces(allowTabs) {
    let i = this.pos - 1;
    let ch;
    do {
      ch = this.buffer[++i];
    } while (ch === " " || allowTabs && ch === "	");
    const n = i - this.pos;
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos = i;
    }
    return n;
  }
  *pushUntil(test) {
    let i = this.pos;
    let ch = this.buffer[i];
    while (!test(ch))
      ch = this.buffer[++i];
    return yield* this.pushToIndex(i, false);
  }
};

// node_modules/yaml/browser/dist/parse/line-counter.js
var LineCounter = class {
  constructor() {
    this.lineStarts = [];
    this.addNewLine = (offset) => this.lineStarts.push(offset);
    this.linePos = (offset) => {
      let low = 0;
      let high = this.lineStarts.length;
      while (low < high) {
        const mid = low + high >> 1;
        if (this.lineStarts[mid] < offset)
          low = mid + 1;
        else
          high = mid;
      }
      if (this.lineStarts[low] === offset)
        return { line: low + 1, col: 1 };
      if (low === 0)
        return { line: 0, col: offset };
      const start = this.lineStarts[low - 1];
      return { line: low, col: offset - start + 1 };
    };
  }
};

// node_modules/yaml/browser/dist/parse/parser.js
function includesToken(list2, type) {
  for (let i = 0; i < list2.length; ++i)
    if (list2[i].type === type)
      return true;
  return false;
}
function findNonEmptyIndex(list2) {
  for (let i = 0; i < list2.length; ++i) {
    switch (list2[i].type) {
      case "space":
      case "comment":
      case "newline":
        break;
      default:
        return i;
    }
  }
  return -1;
}
function isFlowToken(token) {
  switch (token?.type) {
    case "alias":
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "flow-collection":
      return true;
    default:
      return false;
  }
}
function getPrevProps(parent) {
  switch (parent.type) {
    case "document":
      return parent.start;
    case "block-map": {
      const it = parent.items[parent.items.length - 1];
      return it.sep ?? it.start;
    }
    case "block-seq":
      return parent.items[parent.items.length - 1].start;
    /* istanbul ignore next should not happen */
    default:
      return [];
  }
}
function getFirstKeyStartProps(prev) {
  if (prev.length === 0)
    return [];
  let i = prev.length;
  loop: while (--i >= 0) {
    switch (prev[i].type) {
      case "doc-start":
      case "explicit-key-ind":
      case "map-value-ind":
      case "seq-item-ind":
      case "newline":
        break loop;
    }
  }
  while (prev[++i]?.type === "space") {
  }
  return prev.splice(i, prev.length);
}
function arrayPushArray(target, source) {
  if (source.length < 1e5)
    Array.prototype.push.apply(target, source);
  else
    for (let i = 0; i < source.length; ++i)
      target.push(source[i]);
}
function fixFlowSeqItems(fc) {
  if (fc.start.type === "flow-seq-start") {
    for (const it of fc.items) {
      if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
        if (it.key)
          it.value = it.key;
        delete it.key;
        if (isFlowToken(it.value)) {
          if (it.value.end)
            arrayPushArray(it.value.end, it.sep);
          else
            it.value.end = it.sep;
        } else
          arrayPushArray(it.start, it.sep);
        delete it.sep;
      }
    }
  }
}
var Parser = class {
  /**
   * @param onNewLine - If defined, called separately with the start position of
   *   each new line (in `parse()`, including the start of input).
   */
  constructor(onNewLine) {
    this.atNewLine = true;
    this.atScalar = false;
    this.indent = 0;
    this.offset = 0;
    this.onKeyLine = false;
    this.stack = [];
    this.source = "";
    this.type = "";
    this.lexer = new Lexer();
    this.onNewLine = onNewLine;
  }
  /**
   * Parse `source` as a YAML stream.
   * If `incomplete`, a part of the last line may be left as a buffer for the next call.
   *
   * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
   *
   * @returns A generator of tokens representing each directive, document, and other structure.
   */
  *parse(source, incomplete = false) {
    if (this.onNewLine && this.offset === 0)
      this.onNewLine(0);
    for (const lexeme of this.lexer.lex(source, incomplete))
      yield* this.next(lexeme);
    if (!incomplete)
      yield* this.end();
  }
  /**
   * Advance the parser by the `source` of one lexical token.
   */
  *next(source) {
    this.source = source;
    if (this.atScalar) {
      this.atScalar = false;
      yield* this.step();
      this.offset += source.length;
      return;
    }
    const type = tokenType(source);
    if (!type) {
      const message = `Not a YAML token: ${source}`;
      yield* this.pop({ type: "error", offset: this.offset, message, source });
      this.offset += source.length;
    } else if (type === "scalar") {
      this.atNewLine = false;
      this.atScalar = true;
      this.type = "scalar";
    } else {
      this.type = type;
      yield* this.step();
      switch (type) {
        case "newline":
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine)
            this.onNewLine(this.offset + source.length);
          break;
        case "space":
          if (this.atNewLine && source[0] === " ")
            this.indent += source.length;
          break;
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
          if (this.atNewLine)
            this.indent += source.length;
          break;
        case "doc-mode":
        case "flow-error-end":
          return;
        default:
          this.atNewLine = false;
      }
      this.offset += source.length;
    }
  }
  /** Call at end of input to push out any remaining constructions */
  *end() {
    while (this.stack.length > 0)
      yield* this.pop();
  }
  get sourceToken() {
    const st = {
      type: this.type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
    return st;
  }
  *step() {
    const top = this.peek(1);
    if (this.type === "doc-end" && top?.type !== "doc-end") {
      while (this.stack.length > 0)
        yield* this.pop();
      this.stack.push({
        type: "doc-end",
        offset: this.offset,
        source: this.source
      });
      return;
    }
    if (!top)
      return yield* this.stream();
    switch (top.type) {
      case "document":
        return yield* this.document(top);
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return yield* this.scalar(top);
      case "block-scalar":
        return yield* this.blockScalar(top);
      case "block-map":
        return yield* this.blockMap(top);
      case "block-seq":
        return yield* this.blockSequence(top);
      case "flow-collection":
        return yield* this.flowCollection(top);
      case "doc-end":
        return yield* this.documentEnd(top);
    }
    yield* this.pop();
  }
  peek(n) {
    return this.stack[this.stack.length - n];
  }
  *pop(error2) {
    const token = error2 ?? this.stack.pop();
    if (!token) {
      const message = "Tried to pop an empty stack";
      yield { type: "error", offset: this.offset, source: "", message };
    } else if (this.stack.length === 0) {
      yield token;
    } else {
      const top = this.peek(1);
      if (token.type === "block-scalar") {
        token.indent = "indent" in top ? top.indent : 0;
      } else if (token.type === "flow-collection" && top.type === "document") {
        token.indent = 0;
      }
      if (token.type === "flow-collection")
        fixFlowSeqItems(token);
      switch (top.type) {
        case "document":
          top.value = token;
          break;
        case "block-scalar":
          top.props.push(token);
          break;
        case "block-map": {
          const it = top.items[top.items.length - 1];
          if (it.value) {
            top.items.push({ start: [], key: token, sep: [] });
            this.onKeyLine = true;
            return;
          } else if (it.sep) {
            it.value = token;
          } else {
            Object.assign(it, { key: token, sep: [] });
            this.onKeyLine = !it.explicitKey;
            return;
          }
          break;
        }
        case "block-seq": {
          const it = top.items[top.items.length - 1];
          if (it.value)
            top.items.push({ start: [], value: token });
          else
            it.value = token;
          break;
        }
        case "flow-collection": {
          const it = top.items[top.items.length - 1];
          if (!it || it.value)
            top.items.push({ start: [], key: token, sep: [] });
          else if (it.sep)
            it.value = token;
          else
            Object.assign(it, { key: token, sep: [] });
          return;
        }
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.pop(token);
      }
      if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
        const last = token.items[token.items.length - 1];
        if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
          if (top.type === "document")
            top.end = last.start;
          else
            top.items.push({ start: last.start });
          token.items.splice(-1, 1);
        }
      }
    }
  }
  *stream() {
    switch (this.type) {
      case "directive-line":
        yield { type: "directive", offset: this.offset, source: this.source };
        return;
      case "byte-order-mark":
      case "space":
      case "comment":
      case "newline":
        yield this.sourceToken;
        return;
      case "doc-mode":
      case "doc-start": {
        const doc = {
          type: "document",
          offset: this.offset,
          start: []
        };
        if (this.type === "doc-start")
          doc.start.push(this.sourceToken);
        this.stack.push(doc);
        return;
      }
    }
    yield {
      type: "error",
      offset: this.offset,
      message: `Unexpected ${this.type} token in YAML stream`,
      source: this.source
    };
  }
  *document(doc) {
    if (doc.value)
      return yield* this.lineEnd(doc);
    switch (this.type) {
      case "doc-start": {
        if (findNonEmptyIndex(doc.start) !== -1) {
          yield* this.pop();
          yield* this.step();
        } else
          doc.start.push(this.sourceToken);
        return;
      }
      case "anchor":
      case "tag":
      case "space":
      case "comment":
      case "newline":
        doc.start.push(this.sourceToken);
        return;
    }
    const bv = this.startBlockValue(doc);
    if (bv)
      this.stack.push(bv);
    else {
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML document`,
        source: this.source
      };
    }
  }
  *scalar(scalar) {
    if (this.type === "map-value-ind") {
      const prev = getPrevProps(this.peek(2));
      const start = getFirstKeyStartProps(prev);
      let sep;
      if (scalar.end) {
        sep = scalar.end;
        sep.push(this.sourceToken);
        delete scalar.end;
      } else
        sep = [this.sourceToken];
      const map3 = {
        type: "block-map",
        offset: scalar.offset,
        indent: scalar.indent,
        items: [{ start, key: scalar, sep }]
      };
      this.onKeyLine = true;
      this.stack[this.stack.length - 1] = map3;
    } else
      yield* this.lineEnd(scalar);
  }
  *blockScalar(scalar) {
    switch (this.type) {
      case "space":
      case "comment":
      case "newline":
        scalar.props.push(this.sourceToken);
        return;
      case "scalar":
        scalar.source = this.source;
        this.atNewLine = true;
        this.indent = 0;
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        yield* this.pop();
        break;
      /* istanbul ignore next should not happen */
      default:
        yield* this.pop();
        yield* this.step();
    }
  }
  *blockMap(map3) {
    const it = map3.items[map3.items.length - 1];
    switch (this.type) {
      case "newline":
        this.onKeyLine = false;
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            map3.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          it.start.push(this.sourceToken);
        }
        return;
      case "space":
      case "comment":
        if (it.value) {
          map3.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          if (this.atIndentedComment(it.start, map3.indent)) {
            const prev = map3.items[map3.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              map3.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
    }
    if (this.indent >= map3.indent) {
      const atMapIndent = !this.onKeyLine && this.indent === map3.indent;
      const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
      let start = [];
      if (atNextItem && it.sep && !it.value) {
        const nl = [];
        for (let i = 0; i < it.sep.length; ++i) {
          const st = it.sep[i];
          switch (st.type) {
            case "newline":
              nl.push(i);
              break;
            case "space":
              break;
            case "comment":
              if (st.indent > map3.indent)
                nl.length = 0;
              break;
            default:
              nl.length = 0;
          }
        }
        if (nl.length >= 2)
          start = it.sep.splice(nl[1]);
      }
      switch (this.type) {
        case "anchor":
        case "tag":
          if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map3.items.push({ start });
            this.onKeyLine = true;
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "explicit-key-ind":
          if (!it.sep && !it.explicitKey) {
            it.start.push(this.sourceToken);
            it.explicitKey = true;
          } else if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map3.items.push({ start, explicitKey: true });
          } else {
            this.stack.push({
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken], explicitKey: true }]
            });
          }
          this.onKeyLine = true;
          return;
        case "map-value-ind":
          if (it.explicitKey) {
            if (!it.sep) {
              if (includesToken(it.start, "newline")) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else {
                const start2 = getFirstKeyStartProps(it.start);
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                });
              }
            } else if (it.value) {
              map3.items.push({ start: [], key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start, key: null, sep: [this.sourceToken] }]
              });
            } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
              const start2 = getFirstKeyStartProps(it.start);
              const key = it.key;
              const sep = it.sep;
              sep.push(this.sourceToken);
              delete it.key;
              delete it.sep;
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: start2, key, sep }]
              });
            } else if (start.length > 0) {
              it.sep = it.sep.concat(start, this.sourceToken);
            } else {
              it.sep.push(this.sourceToken);
            }
          } else {
            if (!it.sep) {
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            } else if (it.value || atNextItem) {
              map3.items.push({ start, key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [], key: null, sep: [this.sourceToken] }]
              });
            } else {
              it.sep.push(this.sourceToken);
            }
          }
          this.onKeyLine = true;
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (atNextItem || it.value) {
            map3.items.push({ start, key: fs, sep: [] });
            this.onKeyLine = true;
          } else if (it.sep) {
            this.stack.push(fs);
          } else {
            Object.assign(it, { key: fs, sep: [] });
            this.onKeyLine = true;
          }
          return;
        }
        default: {
          const bv = this.startBlockValue(map3);
          if (bv) {
            if (bv.type === "block-seq") {
              if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                yield* this.pop({
                  type: "error",
                  offset: this.offset,
                  message: "Unexpected block-seq-ind on same line with key",
                  source: this.source
                });
                return;
              }
            } else if (atMapIndent) {
              map3.items.push({ start });
            }
            this.stack.push(bv);
            return;
          }
        }
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *blockSequence(seq2) {
    const it = seq2.items[seq2.items.length - 1];
    switch (this.type) {
      case "newline":
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            seq2.items.push({ start: [this.sourceToken] });
        } else
          it.start.push(this.sourceToken);
        return;
      case "space":
      case "comment":
        if (it.value)
          seq2.items.push({ start: [this.sourceToken] });
        else {
          if (this.atIndentedComment(it.start, seq2.indent)) {
            const prev = seq2.items[seq2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              seq2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
      case "anchor":
      case "tag":
        if (it.value || this.indent <= seq2.indent)
          break;
        it.start.push(this.sourceToken);
        return;
      case "seq-item-ind":
        if (this.indent !== seq2.indent)
          break;
        if (it.value || includesToken(it.start, "seq-item-ind"))
          seq2.items.push({ start: [this.sourceToken] });
        else
          it.start.push(this.sourceToken);
        return;
    }
    if (this.indent > seq2.indent) {
      const bv = this.startBlockValue(seq2);
      if (bv) {
        this.stack.push(bv);
        return;
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *flowCollection(fc) {
    const it = fc.items[fc.items.length - 1];
    if (this.type === "flow-error-end") {
      let top;
      do {
        yield* this.pop();
        top = this.peek(1);
      } while (top?.type === "flow-collection");
    } else if (fc.end.length === 0) {
      switch (this.type) {
        case "comma":
        case "explicit-key-ind":
          if (!it || it.sep)
            fc.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
        case "map-value-ind":
          if (!it || it.value)
            fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            Object.assign(it, { key: null, sep: [this.sourceToken] });
          return;
        case "space":
        case "comment":
        case "newline":
        case "anchor":
        case "tag":
          if (!it || it.value)
            fc.items.push({ start: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            it.start.push(this.sourceToken);
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs = this.flowScalar(this.type);
          if (!it || it.value)
            fc.items.push({ start: [], key: fs, sep: [] });
          else if (it.sep)
            this.stack.push(fs);
          else
            Object.assign(it, { key: fs, sep: [] });
          return;
        }
        case "flow-map-end":
        case "flow-seq-end":
          fc.end.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(fc);
      if (bv)
        this.stack.push(bv);
      else {
        yield* this.pop();
        yield* this.step();
      }
    } else {
      const parent = this.peek(2);
      if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
        yield* this.pop();
        yield* this.step();
      } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        fixFlowSeqItems(fc);
        const sep = fc.end.splice(1, fc.end.length);
        sep.push(this.sourceToken);
        const map3 = {
          type: "block-map",
          offset: fc.offset,
          indent: fc.indent,
          items: [{ start, key: fc, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map3;
      } else {
        yield* this.lineEnd(fc);
      }
    }
  }
  flowScalar(type) {
    if (this.onNewLine) {
      let nl = this.source.indexOf("\n") + 1;
      while (nl !== 0) {
        this.onNewLine(this.offset + nl);
        nl = this.source.indexOf("\n", nl) + 1;
      }
    }
    return {
      type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
  }
  startBlockValue(parent) {
    switch (this.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return this.flowScalar(this.type);
      case "block-scalar-header":
        return {
          type: "block-scalar",
          offset: this.offset,
          indent: this.indent,
          props: [this.sourceToken],
          source: ""
        };
      case "flow-map-start":
      case "flow-seq-start":
        return {
          type: "flow-collection",
          offset: this.offset,
          indent: this.indent,
          start: this.sourceToken,
          items: [],
          end: []
        };
      case "seq-item-ind":
        return {
          type: "block-seq",
          offset: this.offset,
          indent: this.indent,
          items: [{ start: [this.sourceToken] }]
        };
      case "explicit-key-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        start.push(this.sourceToken);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, explicitKey: true }]
        };
      }
      case "map-value-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, key: null, sep: [this.sourceToken] }]
        };
      }
    }
    return null;
  }
  atIndentedComment(start, indent) {
    if (this.type !== "comment")
      return false;
    if (this.indent <= indent)
      return false;
    return start.every((st) => st.type === "newline" || st.type === "space");
  }
  *documentEnd(docEnd) {
    if (this.type !== "doc-mode") {
      if (docEnd.end)
        docEnd.end.push(this.sourceToken);
      else
        docEnd.end = [this.sourceToken];
      if (this.type === "newline")
        yield* this.pop();
    }
  }
  *lineEnd(token) {
    switch (this.type) {
      case "comma":
      case "doc-start":
      case "doc-end":
      case "flow-seq-end":
      case "flow-map-end":
      case "map-value-ind":
        yield* this.pop();
        yield* this.step();
        break;
      case "newline":
        this.onKeyLine = false;
      // fallthrough
      case "space":
      case "comment":
      default:
        if (token.end)
          token.end.push(this.sourceToken);
        else
          token.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
    }
  }
};

// node_modules/yaml/browser/dist/public-api.js
function parseOptions(options) {
  const prettyErrors = options.prettyErrors !== false;
  const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
  return { lineCounter, prettyErrors };
}
function parseDocument(source, options = {}) {
  const { lineCounter, prettyErrors } = parseOptions(options);
  const parser2 = new Parser(lineCounter?.addNewLine);
  const composer = new Composer(options);
  let doc = null;
  for (const _doc of composer.compose(parser2.parse(source), true, source.length)) {
    if (!doc)
      doc = _doc;
    else if (doc.options.logLevel !== "silent") {
      doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
      break;
    }
  }
  if (prettyErrors && lineCounter) {
    doc.errors.forEach(prettifyError(source, lineCounter));
    doc.warnings.forEach(prettifyError(source, lineCounter));
  }
  return doc;
}
function parse(src, reviver, options) {
  let _reviver = void 0;
  if (typeof reviver === "function") {
    _reviver = reviver;
  } else if (options === void 0 && reviver && typeof reviver === "object") {
    options = reviver;
  }
  const doc = parseDocument(src, options);
  if (!doc)
    return null;
  doc.warnings.forEach((warning) => warn(doc.options.logLevel, warning));
  if (doc.errors.length > 0) {
    if (doc.options.logLevel !== "silent")
      throw doc.errors[0];
    else
      doc.errors = [];
  }
  return doc.toJS(Object.assign({ reviver: _reviver }, options));
}

// src/mdmark-style/settings.ts
var DEFAULT_SETTINGS = {
  enabled: true,
  targets: ["assistant", "user"],
  parts: {
    table: true,
    heading: true,
    callout: true,
    code: true,
    fold: true,
    terms: true,
    hover_card: true,
    footnote: true,
    row_detail: true,
    steps: true,
    tree: true,
    inline: true,
    stack: true,
    figure: true
  },
  glossary: void 0,
  inject_marker_guide: true
};
var SettingsError = class extends Error {
  name = "SettingsError";
};
var PART_NAMES = Object.keys(DEFAULT_SETTINGS.parts);
var TARGETS = ["assistant", "user"];
var WORKTREES = "/.claude/worktrees/";
var expandHome = (path, home) => path === "~" || path.startsWith("~/") ? `${home}${path.slice(1)}` : path;
var joinPath = (dir, path) => {
  const parts = [];
  for (const part of `${dir}/${path}`.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  return `/${parts.join("/")}`;
};
var dirOf = (path) => path.slice(0, path.lastIndexOf("/")) || "/";
async function settingsPath($) {
  const home = await $.env.get("HOME") ?? "";
  const given = await $.env.get("MDMARK_STYLE_CONFIG");
  if (given !== void 0 && given !== "") {
    return expandHome(given, home);
  }
  const base2 = await $.env.get("XDG_CONFIG_HOME") || `${home}/.config`;
  return `${expandHome(base2, home)}/mdmark-style/settings.yaml`;
}
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var keyError = (where, expected) => new SettingsError(
  `mdmark-style \u306E\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB\u306E\u30AD\u30FC\u304C\u8AAD\u3081\u306A\u3044: ${where}\uFF08${expected}\uFF09`
);
var overlayFlags = (options) => {
  const { next, layer, where } = options;
  for (const key of ["enabled", "inject_marker_guide"]) {
    const value = layer[key];
    if (value === void 0) {
      continue;
    }
    if (typeof value !== "boolean") {
      throw keyError(`${where}.${key}`, "\u771F\u507D\u5024");
    }
    next[key] = value;
  }
};
var overlayTargets = (options) => {
  const { next, value, where } = options;
  if (value === void 0) {
    return;
  }
  if (!Array.isArray(value)) {
    throw keyError(`${where}.targets`, "assistant\u30FBuser \u306E\u4E26\u3073");
  }
  const given = value.filter(
    (target) => TARGETS.includes(String(target))
  );
  next.targets = where === "global" ? [...given] : [.../* @__PURE__ */ new Set([...next.targets, ...given])];
};
var overlayParts = (options) => {
  const { next, value, where } = options;
  if (value === void 0) {
    return;
  }
  if (!isRecord(value)) {
    throw keyError(`${where}.parts`, "\u8F9E\u66F8");
  }
  for (const [name, flag] of Object.entries(value)) {
    if (!PART_NAMES.includes(name) || typeof flag !== "boolean") {
      throw keyError(`${where}.parts.${name}`, "\u90E8\u54C1\u306E\u540D\u524D\u3068\u771F\u507D\u5024");
    }
    next.parts[name] = flag;
  }
};
var overlay = (options) => {
  const { base: base2, layer, where, resolveGlossary } = options;
  if (layer === void 0 || layer === null) {
    return base2;
  }
  if (!isRecord(layer)) {
    throw keyError(where, "\u8F9E\u66F8");
  }
  const next = {
    ...base2,
    parts: { ...base2.parts },
    targets: [...base2.targets]
  };
  overlayFlags({ next, layer, where });
  overlayTargets({ next, value: layer.targets, where });
  overlayParts({ next, value: layer.parts, where });
  if (layer.glossary !== void 0) {
    if (typeof layer.glossary !== "string" || layer.glossary === "") {
      throw keyError(`${where}.glossary`, "\u30D1\u30B9\u306E\u6587\u5B57\u5217");
    }
    next.glossary = resolveGlossary(layer.glossary);
  }
  return next;
};
var matches = (match, projectRoot) => {
  if (typeof match !== "string" || match === "") {
    return false;
  }
  const at = projectRoot.indexOf(WORKTREES);
  const root = at >= 0 ? projectRoot.slice(0, at) : projectRoot;
  if (match.startsWith("/")) {
    const target = match.replace(/\/$/, "");
    return root === target || root.startsWith(`${target}/`);
  }
  return root.slice(root.lastIndexOf("/") + 1) === match;
};
var mergeSettings = (options) => {
  const { raw, projectRoot, configDir, home } = options;
  if (raw === void 0 || raw === null) {
    return DEFAULT_SETTINGS;
  }
  if (!isRecord(raw)) {
    throw keyError("(\u6700\u4E0A\u4F4D)", "global \u3068 projects \u306E\u8F9E\u66F8");
  }
  const resolveFrom = (dir) => (path) => {
    const expanded = expandHome(path, home);
    return expanded.startsWith("/") ? expanded : joinPath(dir, expanded);
  };
  let settings = overlay({
    base: DEFAULT_SETTINGS,
    layer: raw.global,
    where: "global",
    resolveGlossary: resolveFrom(configDir)
  });
  if (raw.projects !== void 0 && !Array.isArray(raw.projects)) {
    throw keyError("projects", "\u4E26\u3073");
  }
  const projects = Array.isArray(raw.projects) ? raw.projects : [];
  for (const [position, project] of projects.entries()) {
    if (!isRecord(project) || !matches(project.match, projectRoot)) {
      continue;
    }
    const { match: _match, ...layer } = project;
    settings = overlay({
      base: settings,
      layer,
      where: `projects[${position}]`,
      resolveGlossary: resolveFrom(projectRoot)
    });
  }
  return settings;
};
async function readSettings($) {
  const path = await settingsPath($);
  if (!await $.fs.exists(path)) {
    return DEFAULT_SETTINGS;
  }
  const text2 = await $.fs.read(path);
  let raw;
  try {
    raw = parse(text2);
  } catch (error2) {
    const reason = error2 instanceof Error ? error2.message.split("\n")[0] : "";
    throw new SettingsError(
      `mdmark-style \u306E\u8A2D\u5B9A\u30D5\u30A1\u30A4\u30EB\u3092 YAML \u3068\u3057\u3066\u8AAD\u3081\u306A\u3044: ${path}\uFF08${reason}\uFF09`
    );
  }
  return mergeSettings({
    raw,
    projectRoot: await $.session.root(),
    configDir: dirOf(path),
    home: await $.env.get("HOME") ?? ""
  });
}

// src/mdmark-style/marker-guide.ts
var MARKER_GUIDE = [
  "mdmark-style: \u8FD4\u7B54\u306E Markdown \u306B\u6B21\u306E\u30DE\u30FC\u30AB\u30FC\u3092\u8A18\u8F09\u3059\u308B\u3068\u3001Claude Code \u306E\u753B\u9762\u3067 mdmark \u306E\u5171\u901A\u30B9\u30BF\u30A4\u30EB\u3067\u63CF\u304D\u307E\u3059\u3002\u30DE\u30FC\u30AB\u30FC\u306F\u753B\u9762\u306B\u51FA\u307E\u305B\u3093\u3002",
  '- \u8868\u306E\u7A2E\u985E: \u8868\u3092 <!-- table: {"kind": "data"} --> \u301C <!-- /table --> \u3067\u56F2\u3080',
  "- \u6CE8\u610F\u66F8\u304D: \u5F15\u7528\u306E 1 \u884C\u76EE\u3092 > [!NOTE]\u30FB[!TIP]\u30FB[!IMPORTANT]\u30FB[!WARNING]\u30FB[!CAUTION] \u306B\u3059\u308B",
  "- \u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u306E\u98FE\u308A: \u76F4\u524D\u306B <!-- code: title=\u30D5\u30A1\u30A4\u30EB\u540D lines --> \u3092\u8A18\u8F09\u3057\u3001\u884C\u672B\u306B // [!code ++] \u306A\u3069\u3092\u4ED8\u3051\u308B",
  "- \u958B\u9589\u306E\u7BC4\u56F2: <!-- details: \u30BF\u30A4\u30C8\u30EB --> \u301C <!-- /details --> \u3067\u56F2\u3080",
  "- \u30B9\u30C6\u30C3\u30D7: \u756A\u53F7\u4ED8\u304D\u30EA\u30B9\u30C8\u3092 <!-- steps --> \u301C <!-- /steps --> \u3067\u56F2\u3080",
  "- \u30D5\u30A1\u30A4\u30EB\u30C4\u30EA\u30FC: \u8A00\u8A9E tree \u306E\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u306B \u251C\u2500\u2500 \u306A\u3069\u306E\u7F6B\u7DDA\u3067\u8A18\u8F09\u3057\u3001\u6CE8\u91C8\u306F\u540D\u524D\u306E\u5F8C\u308D\u306E \u300C # \u300D\u306B\u7D9A\u3051\u308B",
  "- \u30D0\u30C3\u30B8: \u884C\u5185\u306E\u30B3\u30FC\u30C9\u3092 badge:green:\u5B8C\u4E86 \u306E\u3088\u3046\u306B\u8A18\u8F09\u3059\u308B"
].join("\n");
async function injectMarkerGuide($, e, next) {
  const result = await next(e);
  let enabled;
  try {
    enabled = (await readSettings($)).inject_marker_guide;
  } catch (error2) {
    if (!(error2 instanceof SettingsError)) {
      throw error2;
    }
    $.ui.log(error2.message, { to: "debug" });
    return result;
  }
  if (!enabled) {
    return result;
  }
  return {
    ...result,
    additionalContext: [...result.additionalContext ?? [], MARKER_GUIDE]
  };
}

// src/shared/style-tokens.logic.ts
var STYLE_COLORS = {
  calloutNote: {
    light: "#1d4ed8",
    dark: "#7aa2ff",
    css: "--mdmark-color-callout-note"
  },
  calloutTip: {
    light: "#15803d",
    dark: "#4ade80",
    css: "--mdmark-color-callout-tip"
  },
  calloutImportant: {
    light: "#6d28d9",
    dark: "#c4a7ff",
    css: "--mdmark-color-callout-important"
  },
  calloutWarning: {
    light: "#b45309",
    dark: "#fbbf24",
    css: "--mdmark-color-callout-warning"
  },
  calloutCaution: {
    light: "#b91c1c",
    dark: "#f87171",
    css: "--mdmark-color-callout-caution"
  },
  heading: {
    light: "#18181b",
    dark: "#ededef",
    css: "--mdmark-color-heading"
  },
  termUnderline: {
    light: "#52525b",
    dark: "#b4b4bc",
    css: "--mdmark-color-term-underline"
  },
  border: {
    light: "#52525b",
    dark: "#b4b4bc",
    css: "--mdmark-color-muted"
  },
  codeBackground: { light: "#eef1f5", dark: "#2a2d33" },
  userBand: {
    light: "#f0f0f0",
    dark: "#3a3a3a",
    themes: { "light-daltonized": "#dcdcdc" }
  },
  accentBlueBg: {
    light: "#cce2fe",
    dark: "#1a314e",
    css: "--mdmark-color-accent-blue-bg"
  },
  accentBlueText: {
    light: "#1d4ed8",
    dark: "#7aa2ff",
    css: "--mdmark-color-accent-blue-text"
  },
  accentRedBg: {
    light: "#ffd4d1",
    dark: "#472020",
    css: "--mdmark-color-accent-red-bg"
  },
  accentRedText: {
    light: "#b91c1c",
    dark: "#f87171",
    css: "--mdmark-color-accent-red-text"
  },
  accentGreenBg: {
    light: "#cbf2d2",
    dark: "#1a3821",
    css: "--mdmark-color-accent-green-bg"
  },
  accentGreenText: {
    light: "#166534",
    dark: "#4ade80",
    css: "--mdmark-color-accent-green-text"
  },
  accentYellowBg: {
    light: "#fff2af",
    dark: "#40380e",
    css: "--mdmark-color-accent-yellow-bg"
  },
  accentYellowText: {
    light: "#854d0e",
    dark: "#facc15",
    css: "--mdmark-color-accent-yellow-text"
  },
  accentOrangeBg: {
    light: "#fedbc4",
    dark: "#4a2a12",
    css: "--mdmark-color-accent-orange-bg"
  },
  accentOrangeText: {
    light: "#b53a0a",
    dark: "#fb923c",
    css: "--mdmark-color-accent-orange-text"
  },
  accentPurpleBg: {
    light: "#edd8fd",
    dark: "#382446",
    css: "--mdmark-color-accent-purple-bg"
  },
  accentPurpleText: {
    light: "#6d28d9",
    dark: "#c4a7ff",
    css: "--mdmark-color-accent-purple-text"
  },
  accentGrayBg: {
    light: "#e4e6ea",
    dark: "#303033",
    css: "--mdmark-color-accent-gray-bg"
  },
  accentGrayText: {
    light: "#52525b",
    dark: "#b4b4bc",
    css: "--mdmark-color-accent-gray-text"
  },
  surface: {
    light: "#f4f4f5",
    dark: "#1b1b1f",
    css: "--mdmark-color-surface"
  },
  text: {
    light: "#18181b",
    dark: "#ededef",
    css: "--mdmark-color-text"
  }
};
var styleColor = (options) => {
  const color = STYLE_COLORS[options.name];
  const own = options.theme === void 0 ? void 0 : color.themes?.[options.theme];
  if (own !== void 0) {
    return own;
  }
  return options.theme?.startsWith("light") === true ? color.light : color.dark;
};

// node_modules/mdurl/index.mjs
var mdurl_exports = {};
__export(mdurl_exports, {
  decode: () => decode_default,
  encode: () => encode_default,
  format: () => format,
  parse: () => parse_default
});

// node_modules/mdurl/lib/decode.mjs
var decodeCache = {};
function getDecodeCache(exclude) {
  let cache = decodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = decodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    cache.push(ch);
  }
  for (let i = 0; i < exclude.length; i++) {
    const ch = exclude.charCodeAt(i);
    cache[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
  }
  return cache;
}
function decode(string2, exclude) {
  if (typeof exclude !== "string") {
    exclude = decode.defaultChars;
  }
  const cache = getDecodeCache(exclude);
  return string2.replace(/(%[a-f0-9]{2})+/gi, function(seq2) {
    let result = "";
    for (let i = 0, l = seq2.length; i < l; i += 3) {
      const b1 = parseInt(seq2.slice(i + 1, i + 3), 16);
      if (b1 < 128) {
        result += cache[b1];
        continue;
      }
      if ((b1 & 224) === 192 && i + 3 < l) {
        const b2 = parseInt(seq2.slice(i + 4, i + 6), 16);
        if ((b2 & 192) === 128) {
          const chr = b1 << 6 & 1984 | b2 & 63;
          if (chr < 128) {
            result += "\uFFFD\uFFFD";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 3;
          continue;
        }
      }
      if ((b1 & 240) === 224 && i + 6 < l) {
        const b2 = parseInt(seq2.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq2.slice(i + 7, i + 9), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128) {
          const chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
          if (chr < 2048 || chr >= 55296 && chr <= 57343) {
            result += "\uFFFD\uFFFD\uFFFD";
          } else {
            result += String.fromCharCode(chr);
          }
          i += 6;
          continue;
        }
      }
      if ((b1 & 248) === 240 && i + 9 < l) {
        const b2 = parseInt(seq2.slice(i + 4, i + 6), 16);
        const b3 = parseInt(seq2.slice(i + 7, i + 9), 16);
        const b4 = parseInt(seq2.slice(i + 10, i + 12), 16);
        if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
          let chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
          if (chr < 65536 || chr > 1114111) {
            result += "\uFFFD\uFFFD\uFFFD\uFFFD";
          } else {
            chr -= 65536;
            result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
          }
          i += 9;
          continue;
        }
      }
      result += "\uFFFD";
    }
    return result;
  });
}
decode.defaultChars = ";/?:@&=+$,#";
decode.componentChars = "";
var decode_default = decode;

// node_modules/mdurl/lib/encode.mjs
var encodeCache = {};
function getEncodeCache(exclude) {
  let cache = encodeCache[exclude];
  if (cache) {
    return cache;
  }
  cache = encodeCache[exclude] = [];
  for (let i = 0; i < 128; i++) {
    const ch = String.fromCharCode(i);
    if (/^[0-9a-z]$/i.test(ch)) {
      cache.push(ch);
    } else {
      cache.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
    }
  }
  for (let i = 0; i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }
  return cache;
}
function encode(string2, exclude, keepEscaped) {
  if (typeof exclude !== "string") {
    keepEscaped = exclude;
    exclude = encode.defaultChars;
  }
  if (typeof keepEscaped === "undefined") {
    keepEscaped = true;
  }
  const cache = getEncodeCache(exclude);
  let result = "";
  for (let i = 0, l = string2.length; i < l; i++) {
    const code2 = string2.charCodeAt(i);
    if (keepEscaped && code2 === 37 && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string2.slice(i + 1, i + 3))) {
        result += string2.slice(i, i + 3);
        i += 2;
        continue;
      }
    }
    if (code2 < 128) {
      result += cache[code2];
      continue;
    }
    if (code2 >= 55296 && code2 <= 57343) {
      if (code2 >= 55296 && code2 <= 56319 && i + 1 < l) {
        const nextCode = string2.charCodeAt(i + 1);
        if (nextCode >= 56320 && nextCode <= 57343) {
          result += encodeURIComponent(string2[i] + string2[i + 1]);
          i++;
          continue;
        }
      }
      result += "%EF%BF%BD";
      continue;
    }
    result += encodeURIComponent(string2[i]);
  }
  return result;
}
encode.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode.componentChars = "-_.!~*'()";
var encode_default = encode;

// node_modules/mdurl/lib/format.mjs
function format(url) {
  let result = "";
  result += url.protocol || "";
  result += url.slashes ? "//" : "";
  result += url.auth ? url.auth + "@" : "";
  if (url.hostname && url.hostname.indexOf(":") !== -1) {
    result += "[" + url.hostname + "]";
  } else {
    result += url.hostname || "";
  }
  result += url.port ? ":" + url.port : "";
  result += url.pathname || "";
  result += url.search || "";
  result += url.hash || "";
  return result;
}

// node_modules/mdurl/lib/parse.mjs
function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}
var protocolPattern = /^([a-z0-9.+-]+:)/i;
var portPattern = /:[0-9]*$/;
var simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
var delims = ["<", ">", '"', "`", " ", "\r", "\n", "	"];
var unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
var autoEscape = ["'"].concat(unwise);
var nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
var hostEndingChars = ["/", "?", "#"];
var hostnameMaxLen = 255;
var hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
var hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
var hostlessProtocol = {
  javascript: true,
  "javascript:": true
};
var slashedProtocol = {
  http: true,
  https: true,
  ftp: true,
  gopher: true,
  file: true,
  "http:": true,
  "https:": true,
  "ftp:": true,
  "gopher:": true,
  "file:": true
};
function urlParse(url, slashesDenoteHost) {
  if (url && url instanceof Url) return url;
  const u = new Url();
  u.parse(url, slashesDenoteHost);
  return u;
}
Url.prototype.parse = function(url, slashesDenoteHost) {
  let lowerProto, hec, slashes;
  let rest = url;
  rest = rest.trim();
  if (!slashesDenoteHost && url.split("#").length === 1) {
    const simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this;
    }
  }
  let proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === "//";
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }
  if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
    let hostEnd = -1;
    for (let i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    let auth, atSign;
    if (hostEnd === -1) {
      atSign = rest.lastIndexOf("@");
    } else {
      atSign = rest.lastIndexOf("@", hostEnd);
    }
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }
    hostEnd = -1;
    for (let i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }
    if (rest[hostEnd - 1] === ":") {
      hostEnd--;
    }
    const host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);
    this.parseHost(host);
    this.hostname = this.hostname || "";
    const ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
    if (!ipv6Hostname) {
      const hostparts = this.hostname.split(/\./);
      for (let i = 0, l = hostparts.length; i < l; i++) {
        const part = hostparts[i];
        if (!part) {
          continue;
        }
        if (!part.match(hostnamePartPattern)) {
          let newpart = "";
          for (let j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              newpart += "x";
            } else {
              newpart += part[j];
            }
          }
          if (!newpart.match(hostnamePartPattern)) {
            const validParts = hostparts.slice(0, i);
            const notHost = hostparts.slice(i + 1);
            const bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join(".") + rest;
            }
            this.hostname = validParts.join(".");
            break;
          }
        }
      }
    }
    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = "";
    }
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  const qm = rest.indexOf("?");
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) {
    this.pathname = rest;
  }
  if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
    this.pathname = "";
  }
  return this;
};
Url.prototype.parseHost = function(host) {
  let port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ":") {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) {
    this.hostname = host;
  }
};
var parse_default = urlParse;

// node_modules/uc.micro/build/index.mjs
var build_exports = {};
__export(build_exports, {
  Any: () => Any,
  Cc: () => Cc,
  Cf: () => Cf,
  P: () => P,
  S: () => S,
  Z: () => Z
});
var Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var Cc = /[\0-\x1F\x7F-\x9F]/;
var Cf = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;
var P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B4E\u1B4F\u1B5A-\u1B60\u1B7D-\u1B7F\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDD6E\uDEAD\uDED0\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9\uDFD4\uDFD5\uDFD7\uDFD8]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09\uDFE1]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDD6D-\uDD6F\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD839\uDDFF|\uD83A[\uDD5E\uDD5F]/;
var S = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C1\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2429\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E5\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD803[\uDD8E\uDD8F\uDED1-\uDED8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDC00-\uDCEF\uDCFA-\uDCFC\uDD00-\uDEB3\uDEBA-\uDED0\uDEE0-\uDEF0\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED8\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0-\uDCBB\uDCC0\uDCC1\uDCD0-\uDCD8\uDD00-\uDE57\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE8A\uDE8E-\uDEC6\uDEC8\uDECD-\uDEDC\uDEDF-\uDEEA\uDEEF-\uDEF8\uDF00-\uDF92\uDF94-\uDFEF\uDFFA]/;
var Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;

// node_modules/markdown-it/dist/markdown-it.mjs
init_dist();

// node_modules/linkify-it/build/index.mjs
var REBuilder = class {
  src_Any = Any.source;
  src_Cc = Cc.source;
  src_Z = Z.source;
  src_P = P.source;
  src_ZPCc = [
    this.src_Z,
    this.src_P,
    this.src_Cc
  ].join("|");
  src_ZCc = [this.src_Z, this.src_Cc].join("|");
  cache = {};
  opts = {
    maxLength: 1e4,
    urlAuth: false,
    schema_names: []
  };
  constructor(opts = {}) {
    this.opts = {
      ...this.opts,
      ...opts
    };
  }
  set(opts = {}) {
    this.opts = {
      ...this.opts,
      ...opts
    };
    this.cache = {};
    return this;
  }
  escapeRE(str) {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
  }
  nestedPairRE(open, close, depth = 4) {
    const openRE = this.escapeRE(open);
    const closeRE = this.escapeRE(close);
    const atom = `(?:(?!${this.src_ZCc}|${openRE}|${closeRE}).)`;
    let pair = `${openRE}${atom}{0,1000}${closeRE}`;
    for (let level = 2; level <= depth; level++) pair = `${openRE}(?:${atom}|${pair}){0,1000}${closeRE}`;
    return pair;
  }
  get_text_separators() {
    return this.cache.text_separators ??= /[><\uff5c]/;
  }
  get_pseudo_letter() {
    return this.cache.src_pseudo_letter ??= new RegExp(`(?:(?!${this.get_text_separators().source}|${this.src_ZPCc})${this.src_Any})`);
  }
  get_ipv4_addr() {
    return this.cache.src_ip4 ??= /* @__PURE__ */ new RegExp("(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])[.]){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])");
  }
  get_ipv6_addr() {
    const h16 = "[0-9A-Fa-f]{1,4}";
    const ls32 = `(?:(?:${h16}:${h16})|${this.get_ipv4_addr().source})`;
    return this.cache.src_ip6_addr ??= new RegExp(`(?:(?:${h16}:){6}${ls32}|::(?:${h16}:){5}${ls32}|(?:${h16})?::(?:${h16}:){4}${ls32}|(?:(?:${h16}:){0,1}${h16})?::(?:${h16}:){3}${ls32}|(?:(?:${h16}:){0,2}${h16})?::(?:${h16}:){2}${ls32}|(?:(?:${h16}:){0,3}${h16})?::${h16}:${ls32}|(?:(?:${h16}:){0,4}${h16})?::${ls32}|(?:(?:${h16}:){0,5}${h16})?::${h16}|(?:(?:${h16}:){0,6}${h16})?::)`);
  }
  get_ipv6_url_host() {
    return this.cache.src_ip6_host ??= new RegExp(`\\[${this.get_ipv6_addr().source}\\]`);
  }
  get_ipv6_mail_host() {
    return this.cache.src_ipv6_mail_host ??= new RegExp(`\\[IPv6:${this.get_ipv6_addr().source}\\]`);
  }
  get_auth() {
    return this.cache.src_auth ??= new RegExp(`(?:(?:(?!${this.src_ZCc}|[@/\\[\\]()]).){1,50}@)?`);
  }
  get_port() {
    return this.cache.src_port ??= /* @__PURE__ */ new RegExp("(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?");
  }
  get_host_terminator() {
    return this.cache.src_host_terminator ??= new RegExp(`(?=$|${this.get_text_separators().source}|${this.src_ZPCc})(?!${this.opts["---"] ? "-(?!--)|" : "-|"}_|:\\d|\\.-|\\.(?!$|${this.src_ZPCc}))`);
  }
  get_path_terminator() {
    return this.cache.src_path_terminator ??= new RegExp(`${this.src_ZPCc}|${this.get_text_separators().source}`);
  }
  get_path() {
    return this.cache.src_path ??= new RegExp(`(?:[/?#](?:${this.nestedPairRE("[", "]")}|${this.nestedPairRE("(", ")")}|${this.nestedPairRE("{", "}")}|\\"(?:(?!${this.src_ZCc}|["]).){1,100}\\"|\\'(?:(?!${this.src_ZCc}|[']).){1,100}\\'|\\'(?=${this.get_pseudo_letter().source}|[-])|\\.{2,20}[:]?[a-zA-Z0-9%/&]|\\.(?!${this.src_ZCc}|[.]|$)|` + (this.opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-{0,19})|" : "\\-{1,20}|") + `,(?!${this.src_ZCc}|$)|;(?!${this.src_ZCc}|$)|\\!{1,20}(?!${this.src_ZCc}|[!]|$)|\\?(?!${this.src_ZCc}|[?]|$)|` + this.get_path_extra().source + `[\\\\/:%@#&=_~*]|(?!${this.get_path_terminator().source}).){1,${this.opts.maxLength}}|\\/)?`);
  }
  get_mail_name() {
    return this.cache.src_mail_name ??= /* @__PURE__ */ new RegExp("[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9](?:[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9]|[.](?=[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9])){0,63}");
  }
  get_xn() {
    return this.cache.src_xn ??= /* @__PURE__ */ new RegExp("xn--[a-z0-9\\-]{1,59}");
  }
  get_tld() {
    if (this.cache.tld) return this.cache.tld;
    const tlds_src = [...new Set(this.opts.tlds || [])].sort().reverse().join("|");
    this.cache.tld = new RegExp(`${tlds_src || "$#none#$"}|${this.get_xn().source}`);
    return this.cache.tld;
  }
  get_domain_root() {
    return this.cache.src_domain_root ??= new RegExp("(?:" + this.get_xn().source + `|${this.get_pseudo_letter().source}{1,63})`);
  }
  get_domain() {
    return this.cache.src_domain ??= new RegExp("(?:" + this.get_xn().source + `|(?:${this.get_pseudo_letter().source})|(?:${this.get_pseudo_letter().source}(?:-|${this.get_pseudo_letter().source}){0,61}${this.get_pseudo_letter().source}))`);
  }
  get_url_host_port() {
    return this.cache.url_host_port ??= new RegExp("(?:" + this.get_ipv6_url_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,10}${this.get_domain().source}))` + this.get_port().source + this.get_host_terminator().source);
  }
  get_fuzzy_url_host_port() {
    return this.cache.fuzzy_url_host_port ??= new RegExp("(?:" + (this.opts.fuzzyIP ? this.get_ipv4_addr().source + "|" : "") + `(?:(?:(?:${this.get_domain().source})\\.){1,10}(?:${this.get_tld().source})))` + this.get_host_terminator().source);
  }
  get_mail_host() {
    return this.cache.src_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,4}${this.get_domain().source}))` + this.get_host_terminator().source);
  }
  get_fuzzy_mail_host() {
    return this.cache.src_fuzzy_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})[.]){1,4}${this.get_domain_root().source}))` + this.get_host_terminator().source);
  }
  get_path_extra() {
    return this.cache.src_path_extra ??= /* @__PURE__ */ new RegExp("");
  }
  get_fuzzy_mail_host_search() {
    return this.cache.mail_fuzzy_host_search ??= new RegExp(`@${this.get_fuzzy_mail_host().source}`, "ig");
  }
  get_fuzzy_link_search() {
    return this.cache.link_fuzzy_search ??= new RegExp(`(^|(?![.:/\\-_@])(?:[$+<=>^\`|\uFF5C]|${this.src_ZPCc}))(?:(?![$+<=>^\`|\uFF5C])${this.get_fuzzy_url_host_port().source}${this.get_path().source})`, "ig");
  }
  get_http_validator() {
    return this.cache.http_validator ??= new RegExp("\\/\\/" + (this.opts.urlAuth ? this.get_auth().source : "") + this.get_url_host_port().source + this.get_path().source, "iy");
  }
  get_relative_proto_validator() {
    return this.cache.relative_proto_validator ??= new RegExp((this.opts.urlAuth ? this.get_auth().source : "") + `(?:localhost|${this.get_ipv6_url_host().source}|(?:(?:${this.get_domain().source})[.]){1,10}${this.get_domain_root().source})` + this.get_port().source + this.get_host_terminator().source + this.get_path().source, "iy");
  }
  get_mail_name_validator() {
    return this.cache.mail_name_validator ??= new RegExp(`(?:^|${this.get_text_separators().source}|"|\\(|${this.src_ZCc})(${this.get_mail_name().source})$`);
  }
  get_mailto_validator() {
    return this.cache.mailto_validator ??= new RegExp(`${this.get_mail_name().source}@${this.get_mail_host().source}`, "iy");
  }
  get_schema_names() {
    return this.cache.schema_names ??= new RegExp((this.opts.schema_names || []).map((name) => this.escapeRE(name)).join("|"));
  }
  get_schema_search() {
    return this.cache.schema_search ??= new RegExp(`(^|(?!_)(?:[><\uFF5C]|${this.src_ZPCc}))(${this.get_schema_names().source})`, "ig");
  }
  get_schema_at_start() {
    return this.cache.schema_at_start ??= new RegExp(`^${this.get_schema_search().source}`, "i");
  }
};
var web_schema = {
  validate: (text2, pos, self2) => {
    const re = self2.re.get_http_validator();
    re.lastIndex = pos;
    const m = re.exec(text2);
    return m ? m[0].length : 0;
  },
  normalize: (match, self2) => self2.normalize(match)
};
var defaultSchemas = {
  "http:": web_schema,
  "https:": web_schema,
  "ftp:": web_schema,
  "//": {
    validate: function(text2, pos, self2) {
      const re = self2.re.get_relative_proto_validator();
      re.lastIndex = pos;
      const m = re.exec(text2);
      if (m) {
        if (pos >= 3 && text2[pos - 3] === ":") return 0;
        if (pos >= 3 && text2[pos - 3] === "/") return 0;
        return m[0].length;
      }
      return 0;
    },
    normalize: (match, self2) => self2.normalize(match)
  },
  "mailto:": {
    validate: function(text2, pos, self2) {
      const re = self2.re.get_mailto_validator();
      re.lastIndex = pos;
      const m = re.exec(text2);
      return m ? m[0].length : 0;
    },
    normalize: (match, self2) => self2.normalize(match)
  }
};
var tlds_2ch = "a:cdefgilmnoqrstuwxz|b:abdefghijmnorstvwyz|c:acdfghiklmnoruvwxyz|d:ejkmoz|e:cegrstu|f:ijkmor|g:abdefghilmnpqrstuwy|h:kmnrtu|i:delmnoqrst|j:emop|k:eghimnprwyz|l:abcikrstuvy|m:acdeghklmnopqrstuvwxyz|n:acefgilopruz|o:m|p:aefghklmnrstwy|q:a|r:eosuw|s:abcdeghijklmnortuvxyz|t:cdfghjklmnortvwz|u:agksyz|v:aceginu|w:fs|y:et|z:amw";
var tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|\u0440\u0444";
function unpackTlds() {
  const result = tlds_default.split("|");
  tlds_2ch.split("|").forEach((item) => {
    const sep = item.indexOf(":");
    const prefix = item.slice(0, sep);
    for (const suffix of item.slice(sep + 1)) result.push(prefix + suffix);
  });
  return result;
}
var defaultOptions = {
  fuzzyLink: false,
  fuzzyEmail: true,
  fuzzyIP: false,
  "---": false,
  tlds: unpackTlds(),
  urlAuth: false,
  maxLength: 1e4
};
var Match = class {
  /** Prefix (protocol) for matched string. Empty for fuzzy links. */
  schema;
  /** First position of matched string. */
  index;
  /** Next position after matched string. */
  lastIndex;
  /** Matched string. */
  raw;
  /** Normalized text of matched string. */
  text;
  /** Normalized URL of matched string. */
  url;
  constructor(text2, schema4, index, lastIndex) {
    const raw = text2.slice(index, lastIndex);
    this.schema = schema4.toLowerCase();
    this.index = index;
    this.lastIndex = lastIndex;
    this.raw = raw;
    this.text = raw;
    this.url = raw;
  }
};
var LinkifyIt = class {
  __opts__;
  __schemas__;
  re;
  /**
  * Creates new linkifier instance.
  *
  * By default understands:
  *
  * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
  * - "fuzzy" emails (foo@bar.com).
  *
  * See {@link LinkifyConstructorOptions} for available options.
  *
  * @param options Recognition options.
  *
  * @example
  * ```javascript
  * import { LinkifyIt } from 'linkify-it'
  *
  * const linkify = new LinkifyIt({ fuzzyLink: true })
  *
  * linkify
  *   .tlds(require('tlds'))       // Reload with full TLD list
  *   .tlds('onion', true)         // Add unofficial `.onion` domain
  *   .add('ftp:', null)           // Disable `ftp:` protocol
  *   .set({ fuzzyIP: true })      // Enable IPs in fuzzy links
  *
  * console.log(linkify.test('Site github.com!')) // true
  * console.log(linkify.match('Site github.com!'))
  * ```
  */
  constructor(options = {}) {
    const { rebuilder, ...linkifyOptions } = options;
    this.__opts__ = {
      ...defaultOptions,
      ...linkifyOptions
    };
    this.__schemas__ = { ...defaultSchemas };
    this.re = rebuilder || new REBuilder();
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
  }
  /**
  * Add new rule definition.
  *
  * `schema` is a link prefix (usually, protocol name with `:` at the end,
  * `skype:` for example). `linkify-it` makes sure that prefix is not
  * preceded with alphanumeric char and symbols. Only whitespaces and
  * punctuation allowed.
  *
  * `definition` is a rule to check tail after link prefix. To disable an
  * existing rule, pass `null`.
  *
  * @param schema Rule name (fixed pattern prefix).
  * @param definition Schema definition, or `null` to disable the rule.
  *
  * See [twitter mentions example](https://github.com/markdown-it/linkify-it/blob/master/examples/twitter.mjs).
  */
  add(schema4, definition = null) {
    if (!definition) delete this.__schemas__[schema4];
    else {
      const def = {
        normalize: (match, self2) => self2.normalize(match),
        ...definition
      };
      this.__schemas__[schema4] = def;
    }
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Set recognition options for links without schema.
  *
  * @param options Recognition options.
  */
  set(options = {}) {
    this.__opts__ = {
      ...this.__opts__,
      ...options
    };
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Searches linkifiable pattern and returns `true` on success or `false` on fail.
  *
  * @param text Text to scan.
  */
  test(text2) {
    if (!text2.length) return false;
    let m, re;
    re = this.re.get_schema_search();
    re.lastIndex = 0;
    while ((m = re.exec(text2)) !== null) if (this.testSchemaAt(text2, m[2], re.lastIndex)) return true;
    if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
      re = this.re.get_fuzzy_link_search();
      re.lastIndex = 0;
      if (re.exec(text2) !== null) return true;
    }
    if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
      if (text2.indexOf("@") >= 0) {
        const mailHostRe = this.re.get_fuzzy_mail_host_search();
        const mailNameRe = this.re.get_mail_name_validator();
        mailHostRe.lastIndex = 0;
        while ((m = mailHostRe.exec(text2)) !== null) {
          const name = text2.slice(Math.max(0, m.index - 65), m.index);
          if (mailNameRe.test(name)) return true;
        }
      }
    }
    return false;
  }
  /**
  * Similar to {@link LinkifyIt.test} but checks only specific protocol tail exactly
  * at given position. Returns length of found pattern (0 on fail).
  *
  * @param text Text to scan.
  * @param schema Rule (schema) name.
  * @param pos Text offset to check from.
  */
  testSchemaAt(text2, schema4, pos) {
    if (!this.__schemas__[schema4.toLowerCase()]) return 0;
    return this.__schemas__[schema4.toLowerCase()].validate(text2.slice(0, pos + this.__opts__.maxLength), pos, this);
  }
  /**
  * Returns array of found link descriptions or `null` on fail. We strongly
  * recommend to use {@link LinkifyIt.test} first, for best speed.
  *
  * @param text Text to scan.
  */
  match(text2) {
    const result = [];
    const schemaRe = this.re.get_schema_search();
    let fuzzyLinkRe;
    let mailHostRe;
    let mailNameRe;
    let fuzzyLinkCandidate;
    let fuzzyEmailCandidate;
    let schemaPrefix;
    let schemaDone = false;
    let fuzzyLinkDone = false;
    let fuzzyEmailDone = false;
    let pos = 0;
    if (!text2.length) return null;
    schemaRe.lastIndex = 0;
    if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
      fuzzyLinkRe = this.re.get_fuzzy_link_search();
      fuzzyLinkRe.lastIndex = 0;
    }
    if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
      mailHostRe = this.re.get_fuzzy_mail_host_search();
      mailHostRe.lastIndex = 0;
      mailNameRe = this.re.get_mail_name_validator();
    }
    for (; ; ) {
      const scanFrom = Math.max(pos - 1, 0);
      if (mailHostRe && mailNameRe && !fuzzyEmailDone && (!fuzzyEmailCandidate || fuzzyEmailCandidate.index < pos)) {
        if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
        for (; ; ) {
          const m = mailHostRe.exec(text2);
          if (!m) {
            fuzzyEmailDone = true;
            fuzzyEmailCandidate = void 0;
            break;
          }
          const name = mailNameRe.exec(text2.slice(Math.max(0, m.index - 65), m.index));
          if (!name) continue;
          fuzzyEmailCandidate = {
            schema: "mailto:",
            index: m.index - name[1].length,
            lastIndex: m.index + m[0].length
          };
          if (fuzzyEmailCandidate.index >= pos) break;
          if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
        }
      }
      if (fuzzyLinkRe && !fuzzyLinkDone && (!fuzzyLinkCandidate || fuzzyLinkCandidate.index < pos)) {
        if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
        for (; ; ) {
          const m = fuzzyLinkRe.exec(text2);
          if (!m) {
            fuzzyLinkDone = true;
            fuzzyLinkCandidate = void 0;
            break;
          }
          fuzzyLinkCandidate = {
            schema: "",
            index: m.index + m[1].length,
            lastIndex: m.index + m[0].length
          };
          if (fuzzyLinkCandidate.index >= pos) break;
          if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
        }
      }
      let fuzzyCandidate = fuzzyEmailCandidate;
      if (!fuzzyCandidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < fuzzyCandidate.index || fuzzyLinkCandidate.index === fuzzyCandidate.index && fuzzyLinkCandidate.lastIndex > fuzzyCandidate.lastIndex)) fuzzyCandidate = fuzzyLinkCandidate;
      let schemaCandidate;
      if (!schemaDone) for (; ; ) {
        if (!schemaPrefix) {
          if (schemaRe.lastIndex < scanFrom) schemaRe.lastIndex = scanFrom;
          const m = schemaRe.exec(text2);
          if (!m) {
            schemaDone = true;
            break;
          }
          schemaPrefix = {
            schema: m[2],
            index: m.index + m[1].length,
            lastIndex: m.index + m[0].length
          };
        }
        if (schemaPrefix.index < pos) {
          schemaPrefix = void 0;
          continue;
        }
        if (fuzzyCandidate && schemaPrefix.index > fuzzyCandidate.index) break;
        const prefix = schemaPrefix;
        schemaPrefix = void 0;
        const len = this.testSchemaAt(text2, prefix.schema, prefix.lastIndex);
        if (len) {
          schemaCandidate = {
            schema: prefix.schema,
            index: prefix.index,
            lastIndex: prefix.lastIndex + len
          };
          break;
        }
      }
      let candidate = schemaCandidate;
      if (!candidate || fuzzyEmailCandidate && (fuzzyEmailCandidate.index < candidate.index || fuzzyEmailCandidate.index === candidate.index && fuzzyEmailCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyEmailCandidate;
      if (!candidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < candidate.index || fuzzyLinkCandidate.index === candidate.index && fuzzyLinkCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyLinkCandidate;
      if (!candidate) break;
      if (candidate === fuzzyEmailCandidate) fuzzyEmailCandidate = void 0;
      else if (candidate === fuzzyLinkCandidate) fuzzyLinkCandidate = void 0;
      const match = new Match(text2, candidate.schema, candidate.index, candidate.lastIndex);
      if (match.schema) this.__schemas__[match.schema].normalize(match, this);
      else this.normalize(match);
      result.push(match);
      pos = candidate.lastIndex;
    }
    if (result.length) return result;
    return null;
  }
  /**
  * Returns fully-formed (not fuzzy) link if it starts at the beginning
  * of the string, and null otherwise.
  *
  * @param text Text to scan.
  */
  matchAtStart(text2) {
    if (!text2.length) return null;
    const m = this.re.get_schema_at_start().exec(text2);
    if (!m) return null;
    const len = this.testSchemaAt(text2, m[2], m[0].length);
    if (!len) return null;
    const match = new Match(text2, m[2], m.index + m[1].length, m.index + m[0].length + len);
    this.__schemas__[match.schema].normalize(match, this);
    return match;
  }
  /**
  * Load (or merge) new TLDs list. Those are used for fuzzy links (without
  * prefix) to avoid false positives. By default this algorithm is used:
  *
  * - hostname with any 2-letter root zones are ok.
  * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
  *   are ok.
  * - encoded (`xn--...`) root zones are ok.
  *
  * If list is replaced, then exact match for 2-chars root zones will be checked.
  *
  * @param list List of TLDs.
  * @param keepOld Merge with current list if `true` (`false` by default).
  */
  tlds(list2, keepOld = false) {
    list2 = Array.isArray(list2) ? list2 : [list2];
    if (!keepOld) this.__opts__.tlds = list2;
    else this.__opts__.tlds = this.__opts__.tlds.concat(list2);
    this.re.set({
      ...this.__opts__,
      schema_names: Object.keys(this.__schemas__)
    });
    return this;
  }
  /**
  * Default normalizer (if schema does not define its own).
  *
  * @param match Match to normalize.
  */
  normalize(match) {
    if (!match.schema) match.url = `http://${match.url}`;
    if (match.schema === "mailto:" && !/^mailto:/i.test(match.url)) match.url = `mailto:${match.url}`;
  }
};

// node_modules/punycode.js/punycode.es6.js
var maxInt = 2147483647;
var base = 36;
var tMin = 1;
var tMax = 26;
var skew = 38;
var damp = 700;
var initialBias = 72;
var initialN = 128;
var delimiter = "-";
var regexPunycode = /^xn--/;
var regexNonASCII = /[^\0-\x7F]/;
var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
var errors = {
  "overflow": "Overflow: input needs wider integers to process",
  "not-basic": "Illegal input >= 0x80 (not a basic code point)",
  "invalid-input": "Invalid input"
};
var baseMinusTMin = base - tMin;
var floor = Math.floor;
var stringFromCharCode = String.fromCharCode;
function error(type) {
  throw new RangeError(errors[type]);
}
function map2(array, callback) {
  const result = [];
  let length = array.length;
  while (length--) {
    result[length] = callback(array[length]);
  }
  return result;
}
function mapDomain(domain, callback) {
  const parts = domain.split("@");
  let result = "";
  if (parts.length > 1) {
    result = parts[0] + "@";
    domain = parts[1];
  }
  domain = domain.replace(regexSeparators, ".");
  const labels = domain.split(".");
  const encoded = map2(labels, callback).join(".");
  return result + encoded;
}
function ucs2decode(string2) {
  const output = [];
  let counter = 0;
  const length = string2.length;
  while (counter < length) {
    const value = string2.charCodeAt(counter++);
    if (value >= 55296 && value <= 56319 && counter < length) {
      const extra = string2.charCodeAt(counter++);
      if ((extra & 64512) == 56320) {
        output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
      } else {
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
var ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
var basicToDigit = function(codePoint) {
  if (codePoint >= 48 && codePoint < 58) {
    return 26 + (codePoint - 48);
  }
  if (codePoint >= 65 && codePoint < 91) {
    return codePoint - 65;
  }
  if (codePoint >= 97 && codePoint < 123) {
    return codePoint - 97;
  }
  return base;
};
var digitToBasic = function(digit, flag) {
  return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
};
var adapt = function(delta, numPoints, firstTime) {
  let k = 0;
  delta = firstTime ? floor(delta / damp) : delta >> 1;
  delta += floor(delta / numPoints);
  for (; delta > baseMinusTMin * tMax >> 1; k += base) {
    delta = floor(delta / baseMinusTMin);
  }
  return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
};
var decode2 = function(input) {
  const output = [];
  const inputLength = input.length;
  let i = 0;
  let n = initialN;
  let bias = initialBias;
  let basic = input.lastIndexOf(delimiter);
  if (basic < 0) {
    basic = 0;
  }
  for (let j = 0; j < basic; ++j) {
    if (input.charCodeAt(j) >= 128) {
      error("not-basic");
    }
    output.push(input.charCodeAt(j));
  }
  for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (index >= inputLength) {
        error("invalid-input");
      }
      const digit = basicToDigit(input.charCodeAt(index++));
      if (digit >= base) {
        error("invalid-input");
      }
      if (digit > floor((maxInt - i) / w)) {
        error("overflow");
      }
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) {
        break;
      }
      const baseMinusT = base - t;
      if (w > floor(maxInt / baseMinusT)) {
        error("overflow");
      }
      w *= baseMinusT;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi == 0);
    if (floor(i / out) > maxInt - n) {
      error("overflow");
    }
    n += floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
};
var encode2 = function(input) {
  const output = [];
  input = ucs2decode(input);
  const inputLength = input.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;
  for (const currentValue of input) {
    if (currentValue < 128) {
      output.push(stringFromCharCode(currentValue));
    }
  }
  const basicLength = output.length;
  let handledCPCount = basicLength;
  if (basicLength) {
    output.push(delimiter);
  }
  while (handledCPCount < inputLength) {
    let m = maxInt;
    for (const currentValue of input) {
      if (currentValue >= n && currentValue < m) {
        m = currentValue;
      }
    }
    const handledCPCountPlusOne = handledCPCount + 1;
    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
      error("overflow");
    }
    delta += (m - n) * handledCPCountPlusOne;
    n = m;
    for (const currentValue of input) {
      if (currentValue < n && ++delta > maxInt) {
        error("overflow");
      }
      if (currentValue === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) {
            break;
          }
          const qMinusT = q - t;
          const baseMinusT = base - t;
          output.push(
            stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
          );
          q = floor(qMinusT / baseMinusT);
        }
        output.push(stringFromCharCode(digitToBasic(q, 0)));
        bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
        delta = 0;
        ++handledCPCount;
      }
    }
    ++delta;
    ++n;
  }
  return output.join("");
};
var toUnicode = function(input) {
  return mapDomain(input, function(string2) {
    return regexPunycode.test(string2) ? decode2(string2.slice(4).toLowerCase()) : string2;
  });
};
var toASCII = function(input) {
  return mapDomain(input, function(string2) {
    return regexNonASCII.test(string2) ? "xn--" + encode2(string2) : string2;
  });
};
var punycode = {
  /**
   * A string representing the current Punycode.js version number.
   * @memberOf punycode
   * @type String
   */
  "version": "2.3.1",
  /**
   * An object of methods to convert from JavaScript's internal character
   * representation (UCS-2) to Unicode code points, and back.
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode
   * @type Object
   */
  "ucs2": {
    "decode": ucs2decode,
    "encode": ucs2encode
  },
  "decode": decode2,
  "encode": encode2,
  "toASCII": toASCII,
  "toUnicode": toUnicode
};
var punycode_es6_default = punycode;

// node_modules/markdown-it/dist/markdown-it.mjs
var __defProp2 = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
  let target = {};
  for (var name in all) __defProp2(target, name, {
    get: all[name],
    enumerable: true
  });
  if (!no_symbols) __defProp2(target, Symbol.toStringTag, { value: "Module" });
  return target;
};
var utils_exports = /* @__PURE__ */ __exportAll({
  arrayReplaceAt: () => arrayReplaceAt,
  asciiTrim: () => asciiTrim,
  callable: () => callable,
  escapeHtml: () => escapeHtml,
  escapeRE: () => escapeRE,
  fromCodePoint: () => fromCodePoint,
  isMdAsciiPunct: () => isMdAsciiPunct,
  isPunctChar: () => isPunctChar,
  isPunctCharCode: () => isPunctCharCode,
  isSpace: () => isSpace,
  isValidEntityCode: () => isValidEntityCode,
  isWhiteSpace: () => isWhiteSpace,
  lib: () => lib,
  normalizeReference: () => normalizeReference,
  unescapeAll: () => unescapeAll,
  unescapeMd: () => unescapeMd
});
function callable(cls) {
  const wrapper = function(...args) {
    return Reflect.construct(cls, args, new.target && new.target !== wrapper ? new.target : cls);
  };
  Object.defineProperty(wrapper, "name", { value: cls.name });
  Object.setPrototypeOf(wrapper, cls);
  wrapper.prototype = cls.prototype;
  return wrapper;
}
function arrayReplaceAt(src, pos, newElements) {
  return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
}
function isValidEntityCode(c) {
  if (c >= 55296 && c <= 57343) return false;
  if (c >= 64976 && c <= 65007) return false;
  if ((c & 65535) === 65535 || (c & 65535) === 65534) return false;
  if (c >= 0 && c <= 8) return false;
  if (c === 11) return false;
  if (c >= 14 && c <= 31) return false;
  if (c >= 127 && c <= 159) return false;
  if (c > 1114111) return false;
  return true;
}
function fromCodePoint(c) {
  if (c > 65535) {
    c -= 65536;
    const surrogate1 = 55296 + (c >> 10);
    const surrogate2 = 56320 + (c & 1023);
    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}
var UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
var UNESCAPE_ALL_RE = new RegExp(`${UNESCAPE_MD_RE.source}|${/&([a-z#][a-z0-9]{1,31});/gi.source}`, "gi");
var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;
function replaceEntityPattern(match, name) {
  if (name.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name)) {
    const code2 = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    if (isValidEntityCode(code2)) return fromCodePoint(code2);
    return match;
  }
  const decoded = decodeHTMLStrict(match);
  if (decoded !== match) return decoded;
  return match;
}
function unescapeMd(str) {
  if (str.indexOf("\\") < 0) return str;
  return str.replace(UNESCAPE_MD_RE, "$1");
}
function unescapeAll(str) {
  if (str.indexOf("\\") < 0 && str.indexOf("&") < 0) return str;
  return str.replace(UNESCAPE_ALL_RE, function(match, escaped, entity2) {
    if (escaped) return escaped;
    return replaceEntityPattern(match, entity2);
  });
}
var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};
function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}
function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  return str;
}
var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
function escapeRE(str) {
  return str.replace(REGEXP_ESCAPE_RE, "\\$&");
}
function isSpace(code2) {
  switch (code2) {
    case 9:
    case 32:
      return true;
  }
  return false;
}
function isWhiteSpace(code2) {
  if (code2 >= 8192 && code2 <= 8202) return true;
  switch (code2) {
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 32:
    case 160:
    case 5760:
    case 8239:
    case 8287:
    case 12288:
      return true;
  }
  return false;
}
function isPunctChar(ch) {
  return P.test(ch) || S.test(ch);
}
function isPunctCharCode(code2) {
  return isPunctChar(fromCodePoint(code2));
}
function isMdAsciiPunct(ch) {
  switch (ch) {
    case 33:
    case 34:
    case 35:
    case 36:
    case 37:
    case 38:
    case 39:
    case 40:
    case 41:
    case 42:
    case 43:
    case 44:
    case 45:
    case 46:
    case 47:
    case 58:
    case 59:
    case 60:
    case 61:
    case 62:
    case 63:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 124:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function normalizeReference(str) {
  str = str.trim().replace(/\s+/g, " ");
  return str.toLowerCase().toUpperCase();
}
function isAsciiTrimmable(c) {
  return c === 32 || c === 9 || c === 10 || c === 13;
}
function asciiTrim(str) {
  let start = 0;
  for (; start < str.length; start++) if (!isAsciiTrimmable(str.charCodeAt(start))) break;
  let end = str.length - 1;
  for (; end >= start; end--) if (!isAsciiTrimmable(str.charCodeAt(end))) break;
  return str.slice(start, end + 1);
}
var lib = {
  mdurl: mdurl_exports,
  ucmicro: build_exports
};
function parseLinkLabel(state, start, disableNested) {
  let level, found, marker, prevPos;
  const max = state.posMax;
  const oldPos = state.pos;
  state.pos = start + 1;
  level = 1;
  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 93) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }
    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 91) {
      if (prevPos === state.pos - 1) level++;
      else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }
  let labelEnd = -1;
  if (found) labelEnd = state.pos;
  state.pos = oldPos;
  return labelEnd;
}
function parseLinkDestination(str, start, max) {
  let code2;
  let pos = start;
  const result = {
    ok: false,
    pos: 0,
    str: ""
  };
  if (str.charCodeAt(pos) === 60) {
    pos++;
    while (pos < max) {
      code2 = str.charCodeAt(pos);
      if (code2 === 10) return result;
      if (code2 === 60) return result;
      if (code2 === 62) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code2 === 92 && pos + 1 < max) {
        pos += 2;
        continue;
      }
      pos++;
    }
    return result;
  }
  let level = 0;
  while (pos < max) {
    code2 = str.charCodeAt(pos);
    if (code2 === 32) break;
    if (code2 < 32 || code2 === 127) break;
    if (code2 === 92 && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 32) {
        pos++;
        continue;
      }
      pos += 2;
      continue;
    }
    if (code2 === 40) {
      level++;
      if (level > 32) return result;
    }
    if (code2 === 41) {
      if (level === 0) break;
      level--;
    }
    pos++;
  }
  if (start === pos) return result;
  if (level !== 0) return result;
  result.str = unescapeAll(str.slice(start, pos));
  result.pos = pos;
  result.ok = true;
  return result;
}
function parseLinkTitle(str, start, max, prev_state) {
  let code2;
  let pos = start;
  const state = {
    ok: false,
    can_continue: false,
    pos: 0,
    str: "",
    marker: 0
  };
  if (prev_state) {
    state.str = prev_state.str;
    state.marker = prev_state.marker;
  } else {
    if (pos >= max) return state;
    let marker = str.charCodeAt(pos);
    if (marker !== 34 && marker !== 39 && marker !== 40) return state;
    start++;
    pos++;
    if (marker === 40) marker = 41;
    state.marker = marker;
  }
  while (pos < max) {
    code2 = str.charCodeAt(pos);
    if (code2 === state.marker) {
      state.pos = pos + 1;
      state.str += unescapeAll(str.slice(start, pos));
      state.ok = true;
      return state;
    } else if (code2 === 40 && state.marker === 41) return state;
    else if (code2 === 92 && pos + 1 < max) pos++;
    pos++;
  }
  state.can_continue = true;
  state.str += unescapeAll(str.slice(start, pos));
  return state;
}
var helpers_exports = /* @__PURE__ */ __exportAll({
  parseLinkDestination: () => parseLinkDestination,
  parseLinkLabel: () => parseLinkLabel,
  parseLinkTitle: () => parseLinkTitle
});
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o2) {
    return typeof o2;
  } : function(o2) {
    return o2 && "function" == typeof Symbol && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
  }, _typeof(o);
}
function toPrimitive(t, r) {
  if ("object" != _typeof(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}
function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}
function _defineProperty(e, r, t) {
  return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t, e;
}
var Token = class {
  constructor(type, tag, nesting) {
    _defineProperty(
      this,
      /**
      * Source map info. Format: `[ line_begin, line_end ]`
      */
      "map",
      null
    );
    _defineProperty(
      this,
      /**
      * nesting level, the same as `state.level`
      */
      "level",
      0
    );
    _defineProperty(
      this,
      /**
      * An array of child nodes (inline and img tokens)
      */
      "children",
      null
    );
    _defineProperty(
      this,
      /**
      * In a case of self-closing tag (code, html, fence, etc.),
      * it has contents of this tag.
      */
      "content",
      ""
    );
    _defineProperty(
      this,
      /**
      * '*' or '_' for emphasis, fence string for fence, etc.
      */
      "markup",
      ""
    );
    _defineProperty(
      this,
      /**
      * Additional information:
      *
      * - Info string for "fence" tokens
      * - The value "auto" for autolink "link_open" and "link_close" tokens
      * - The string value of the item marker for ordered-list "list_item_open" tokens
      */
      "info",
      ""
    );
    _defineProperty(
      this,
      /**
      * True for block-level tokens, false for inline tokens.
      * Used in renderer to calculate line breaks
      */
      "block",
      false
    );
    _defineProperty(
      this,
      /**
      * If it's true, ignore this element when rendering. Used for tight lists
      * to hide paragraphs.
      */
      "hidden",
      false
    );
    this.type = type;
    this.tag = tag;
    this.attrs = null;
    this.nesting = nesting;
    this.meta = null;
  }
  /**
  * Search attribute index by name.
  */
  attrIndex(name) {
    if (!this.attrs) return -1;
    const attrs = this.attrs;
    for (let i = 0, len = attrs.length; i < len; i++) if (attrs[i][0] === name) return i;
    return -1;
  }
  /**
  * Add `[ name, value ]` attribute to list. Init attrs if necessary
  */
  attrPush(attrData) {
    if (this.attrs) this.attrs.push(attrData);
    else this.attrs = [attrData];
  }
  /**
  * Set `name` attribute to `value`. Override old value if exists.
  */
  attrSet(name, value) {
    const idx = this.attrIndex(name);
    const attrData = [name, value];
    if (idx < 0) this.attrPush(attrData);
    else this.attrs[idx] = attrData;
  }
  /**
  * Get the value of attribute `name`, or null if it does not exist.
  */
  attrGet(name) {
    const idx = this.attrIndex(name);
    let value = null;
    if (idx >= 0) value = this.attrs[idx][1];
    return value;
  }
  /**
  * Join value to existing attribute via space. Or create new attribute if not
  * exists. Useful to operate with token classes.
  */
  attrJoin(name, value) {
    const idx = this.attrIndex(name);
    if (idx < 0) this.attrPush([name, value]);
    else this.attrs[idx][1] = `${this.attrs[idx][1]} ${value}`;
  }
};
var Ruler = class {
  constructor() {
    _defineProperty(
      this,
      /** @internal */
      "__rules__",
      []
    );
    _defineProperty(
      this,
      /** @internal */
      "__cache__",
      null
    );
  }
  /** @internal */
  __find__(name) {
    for (let i = 0; i < this.__rules__.length; i++) if (this.__rules__[i].name === name) return i;
    return -1;
  }
  /** @internal */
  __compile__() {
    const chains = /* @__PURE__ */ new Set();
    this.__rules__.forEach((rule) => {
      if (!rule.enabled) return;
      rule.alt.forEach((altName) => {
        if (altName) chains.add(altName);
      });
    });
    this.__cache__ = /* @__PURE__ */ Object.create(null);
    this.__cache__[""] = [];
    this.__rules__.forEach((rule) => {
      if (rule.enabled) this.__cache__[""].push(rule.fn);
    });
    chains.forEach((chain) => {
      this.__cache__[chain] = [];
      this.__rules__.forEach((rule) => {
        if (rule.enabled && rule.alt.indexOf(chain) >= 0) this.__cache__[chain].push(rule.fn);
      });
    });
  }
  /**
  * Replace rule by name with new function & options. Throws error if name not
  * found.
  *
  * @example Replace existing typographer replacement rule with new one
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.core.ruler.at('replacements', function replace(state) {
  *   //...
  * });
  * ```
  */
  at(name, fn, options = {}) {
    const index = this.__find__(name);
    if (index === -1) throw new Error(`Parser rule not found: ${name}`);
    this.__rules__[index].fn = fn;
    this.__rules__[index].alt = options.alt || [];
    this.__cache__ = null;
  }
  /**
  * Add new rule to chain before one with given name. See also
  * {@link Ruler.after}, {@link Ruler.push}.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  before(beforeName, ruleName, fn, options = {}) {
    const index = this.__find__(beforeName);
    if (index === -1) throw new Error(`Parser rule not found: ${beforeName}`);
    this.__rules__.splice(index, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Add new rule to chain after one with given name. See also
  * {@link Ruler.before}, {@link Ruler.push}.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.inline.ruler.after('text', 'my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  after(afterName, ruleName, fn, options = {}) {
    const index = this.__find__(afterName);
    if (index === -1) throw new Error(`Parser rule not found: ${afterName}`);
    this.__rules__.splice(index + 1, 0, {
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Push new rule to the end of chain. See also
  * {@link Ruler.before}, {@link Ruler.after}.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * md.core.ruler.push('my_rule', function replace(state) {
  *   //...
  * });
  * ```
  */
  push(ruleName, fn, options = {}) {
    this.__rules__.push({
      name: ruleName,
      enabled: true,
      fn,
      alt: options.alt || []
    });
    this.__cache__ = null;
  }
  /**
  * Enable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * See also {@link Ruler.disable}, {@link Ruler.enableOnly}.
  *
  * Returns list of found rule names (if no exception happened).
  */
  enable(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    const result = [];
    list2.forEach((name) => {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) return;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = true;
      result.push(name);
    });
    this.__cache__ = null;
    return result;
  }
  /**
  * Enable rules with given names, and disable everything else. If any rule name
  * not found - throw Error. Errors can be disabled by second param.
  *
  * See also {@link Ruler.disable}, {@link Ruler.enable}.
  */
  enableOnly(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    this.__rules__.forEach((rule) => {
      rule.enabled = false;
    });
    this.enable(list2, ignoreInvalid);
  }
  /**
  * Disable rules with given names. If any rule name not found - throw Error.
  * Errors can be disabled by second param.
  *
  * See also {@link Ruler.enable}, {@link Ruler.enableOnly}.
  *
  * Returns list of found rule names (if no exception happened).
  */
  disable(list2, ignoreInvalid = false) {
    if (!Array.isArray(list2)) list2 = [list2];
    const result = [];
    list2.forEach((name) => {
      const idx = this.__find__(name);
      if (idx < 0) {
        if (ignoreInvalid) return;
        throw new Error(`Rules manager: invalid rule name ${name}`);
      }
      this.__rules__[idx].enabled = false;
      result.push(name);
    });
    this.__cache__ = null;
    return result;
  }
  /**
  * Return array of active functions (rules) for given chain name. It analyzes
  * rules configuration, compiles caches if not exists and returns result.
  *
  * Default chain name is `''` (empty string). It can't be skipped. That's
  * done intentionally, to keep signature monomorphic for high speed.
  */
  getRules(chainName) {
    if (!this.__cache__) this.__compile__();
    return this.__cache__[chainName] || [];
  }
};
var default_rules = {};
default_rules.code_inline = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<code${slf.renderAttrs(token)}>${escapeHtml(token.content)}</code>`;
};
default_rules.code_block = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  return `<pre${slf.renderAttrs(token)}><code>${escapeHtml(tokens[idx].content)}</code></pre>
`;
};
default_rules.fence = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  const info = token.info ? unescapeAll(token.info).trim() : "";
  let langName = "";
  let langAttrs = "";
  if (info) {
    const arr = info.split(/(\s+)/g);
    langName = arr[0];
    langAttrs = arr.slice(2).join("");
  }
  let highlighted;
  if (options.highlight) highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml(token.content);
  else highlighted = escapeHtml(token.content);
  if (highlighted.indexOf("<pre") === 0) return highlighted + "\n";
  if (info) {
    const i = token.attrIndex("class");
    const tmpAttrs = token.attrs ? token.attrs.slice() : [];
    if (i < 0) tmpAttrs.push(["class", `${options.langPrefix}${langName}`]);
    else {
      tmpAttrs[i] = [tmpAttrs[i][0], tmpAttrs[i][1]];
      tmpAttrs[i][1] += ` ${options.langPrefix}${langName}`;
    }
    const tmpToken = { attrs: tmpAttrs };
    return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>
`;
  }
  return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>
`;
};
default_rules.image = function(tokens, idx, options, env, slf) {
  const token = tokens[idx];
  token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
  return slf.renderToken(tokens, idx, options);
};
default_rules.hardbreak = function(tokens, idx, options) {
  return options.xhtmlOut ? "<br />\n" : "<br>\n";
};
default_rules.softbreak = function(tokens, idx, options) {
  return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
};
default_rules.text = function(tokens, idx) {
  return escapeHtml(tokens[idx].content);
};
default_rules.html_block = function(tokens, idx) {
  return tokens[idx].content;
};
default_rules.html_inline = function(tokens, idx) {
  return tokens[idx].content;
};
var Renderer = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * Contains render rules for tokens. Can be updated and extended.
      *
      * See [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts)
      * for more details and examples.
      *
      * @example Custom render rules
      * ```javascript
      * import MarkdownIt from 'markdown-it'
      * const md = new MarkdownIt()
      *
      * md.renderer.rules.strong_open  = function () { return '<b>'; };
      * md.renderer.rules.strong_close = function () { return '</b>'; };
      *
      * const result = md.renderInline(...);
      * ```
      *
      * @example Each rule is called as independent static function with fixed signature
      * ```javascript
      * function my_token_render(tokens, idx, options, env, renderer) {
      *   // ...
      *   return renderedHTML;
      * }
      * ```
      */
      "rules",
      Object.assign({}, default_rules)
    );
  }
  /**
  * Render token attributes to string.
  */
  renderAttrs(token) {
    let i, l, result;
    if (!token.attrs) return "";
    result = "";
    for (i = 0, l = token.attrs.length; i < l; i++) result += ` ${escapeHtml(token.attrs[i][0])}="${escapeHtml(String(token.attrs[i][1]))}"`;
    return result;
  }
  /**
  * Default token renderer. Can be overriden by custom function
  * in {@link Renderer.rules}.
  */
  renderToken(tokens, idx, options) {
    const token = tokens[idx];
    let result = "";
    if (token.hidden) return "";
    let prev = idx - 1;
    while (prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === 0) prev--;
    if (token.block && token.nesting !== -1 && prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === -1) result += "\n";
    result += (token.nesting === -1 ? "</" : "<") + token.tag;
    result += this.renderAttrs(token);
    if (token.nesting === 0 && options.xhtmlOut) result += " /";
    let needLf = false;
    if (token.block) {
      needLf = true;
      if (token.nesting === 1) {
        let next = idx + 1;
        while (next < tokens.length && tokens[next].hidden && tokens[next].nesting === 0) next++;
        if (next < tokens.length) {
          const nextToken = tokens[next];
          if (nextToken.type === "inline" || nextToken.hidden) needLf = false;
          else if (nextToken.nesting === -1 && nextToken.tag === token.tag) needLf = false;
        }
      }
    }
    result += needLf ? ">\n" : ">";
    return result;
  }
  /**
  * The same as {@link Renderer.render}, but for single token of `inline` type.
  */
  renderInline(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type;
      if (typeof rules[type] !== "undefined") result += rules[type](tokens, i, options, env, this);
      else result += this.renderToken(tokens, i, options);
    }
    return result;
  }
  /**
  * Special kludge for image `alt` attributes to conform CommonMark spec.
  * Don't try to use it! Spec requires to show `alt` content with stripped markup,
  * instead of simple escaping.
  */
  renderInlineAsText(tokens, options, env) {
    let result = "";
    for (let i = 0, len = tokens.length; i < len; i++) switch (tokens[i].type) {
      case "text":
      case "code_inline":
        result += tokens[i].content;
        break;
      case "image":
        result += this.renderInlineAsText(tokens[i].children, options, env);
        break;
      case "html_inline":
      case "html_block":
        result += tokens[i].content;
        break;
      case "softbreak":
      case "hardbreak":
        result += "\n";
    }
    return result;
  }
  /**
  * Takes token stream and generates HTML. Probably, you will never need to call
  * this method directly.
  */
  render(tokens, options, env) {
    let result = "";
    const rules = this.rules;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const type = tokens[i].type;
      if (type === "inline") result += this.renderInline(tokens[i].children, options, env);
      else if (typeof rules[type] !== "undefined") result += rules[type](tokens, i, options, env, this);
      else result += this.renderToken(tokens, i, options);
    }
    return result;
  }
};
var StateCore = class {
  constructor(src, md, env) {
    _defineProperty(this, "tokens", []);
    _defineProperty(this, "inlineMode", false);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.env = env;
    this.md = md;
  }
};
var UNNORMALIZED_NEWLINE_RE = /\r\n?/g;
var NULL_RE = /\0/g;
function normalize(state) {
  let str;
  str = state.src.replace(UNNORMALIZED_NEWLINE_RE, "\n");
  str = str.replace(NULL_RE, "\uFFFD");
  state.src = str;
}
function block(state) {
  let token;
  if (state.inlineMode) {
    token = new state.Token("inline", "", 0);
    token.content = state.src;
    token.map = [0, 1];
    token.children = [];
    state.tokens.push(token);
  } else state.md.block.parse(state.src, state.md, state.env, state.tokens);
}
function strip_references(state) {
  const tokens = state.tokens;
  let last = 0;
  for (let curr = 0; curr < tokens.length; curr++) {
    if (tokens[curr].type === "reference_definition") continue;
    if (curr !== last) tokens[last] = tokens[curr];
    last++;
  }
  if (tokens.length !== last) tokens.length = last;
}
function inline(state) {
  const tokens = state.tokens;
  for (let i = 0, l = tokens.length; i < l; i++) {
    const tok = tokens[i];
    if (tok.type === "inline") state.md.inline.parse(tok.content, state.md, state.env, tok.children);
  }
}
function isLinkOpen$1(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose$1(str) {
  return /^<\/a\s*>/i.test(str);
}
function linkify$1(state) {
  const blockTokens = state.tokens;
  if (!state.md.options.linkify) return;
  for (let j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== "inline" || !state.md.linkify.test(blockTokens[j].content)) continue;
    const tokens = blockTokens[j].children;
    const replacements = [];
    let htmlLinkLevel = 0;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const currentToken = tokens[i];
      if (currentToken.type === "link_close") {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open") i--;
        continue;
      }
      if (currentToken.type === "html_inline") {
        if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) htmlLinkLevel--;
        if (isLinkClose$1(currentToken.content)) htmlLinkLevel++;
      }
      if (htmlLinkLevel > 0) continue;
      if (currentToken.type === "text" && state.md.linkify.test(currentToken.content)) {
        const text2 = currentToken.content;
        let links = state.md.linkify.match(text2);
        const nodes = [];
        let level = currentToken.level;
        let lastPos = 0;
        if (links.length > 0 && links[0].index === 0 && i > 0 && tokens[i - 1].type === "text_special") links = links.slice(1);
        for (let ln = 0; ln < links.length; ln++) {
          const url = links[ln].url;
          const fullUrl = state.md.normalizeLink(url);
          if (!state.md.validateLink(fullUrl)) continue;
          let urlText = links[ln].text;
          if (!links[ln].schema) urlText = state.md.normalizeLinkText(`http://${urlText}`).replace(/^http:\/\//, "");
          else if (links[ln].schema === "mailto:" && !/^mailto:/i.test(urlText)) urlText = state.md.normalizeLinkText(`mailto:${urlText}`).replace(/^mailto:/, "");
          else urlText = state.md.normalizeLinkText(urlText);
          const pos = links[ln].index;
          if (pos > lastPos) {
            const token = new state.Token("text", "", 0);
            token.content = text2.slice(lastPos, pos);
            token.level = level;
            nodes.push(token);
          }
          const token_o = new state.Token("link_open", "a", 1);
          token_o.attrs = [["href", fullUrl]];
          token_o.level = level++;
          token_o.markup = "linkify";
          token_o.info = "auto";
          nodes.push(token_o);
          const token_t = new state.Token("text", "", 0);
          token_t.content = urlText;
          token_t.level = level;
          nodes.push(token_t);
          const token_c = new state.Token("link_close", "a", -1);
          token_c.level = --level;
          token_c.markup = "linkify";
          token_c.info = "auto";
          nodes.push(token_c);
          lastPos = links[ln].lastIndex;
        }
        if (lastPos < text2.length) {
          const token = new state.Token("text", "", 0);
          token.content = text2.slice(lastPos);
          token.level = level;
          nodes.push(token);
        }
        replacements.push({
          index: i,
          nodes
        });
      }
    }
    if (replacements.length > 0) {
      let newTokensLength = tokens.length;
      for (const replacement of replacements) newTokensLength += replacement.nodes.length - 1;
      const newTokens = new Array(newTokensLength);
      let replacementIndex = 0;
      let newTokenIndex = 0;
      replacements.reverse();
      for (let i = 0; i < tokens.length; i++) {
        const replacement = replacements[replacementIndex];
        if ((replacement === null || replacement === void 0 ? void 0 : replacement.index) === i) {
          for (const node of replacement.nodes) newTokens[newTokenIndex++] = node;
          replacementIndex++;
        } else newTokens[newTokenIndex++] = tokens[i];
      }
      blockTokens[j].children = newTokens;
    }
  }
}
var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
var SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i;
var SCOPED_ABBR_RE = /\((c|tm|r)\)/gi;
var SCOPED_ABBR = {
  c: "\xA9",
  r: "\xAE",
  tm: "\u2122"
};
function replaceFn(match, name) {
  return SCOPED_ABBR[name.toLowerCase()];
}
function replace_scoped(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace_rare(inlineTokens) {
  let inside_autolink = 0;
  for (let i = inlineTokens.length - 1; i >= 0; i--) {
    const token = inlineTokens[i];
    if (token.type === "text" && !inside_autolink) {
      if (RARE_RE.test(token.content)) token.content = token.content.replace(/\+-/g, "\xB1").replace(/\.{2,}/g, "\u2026").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/gm, "$1\u2014").replace(/(^|\s)--(?=\s|$)/gm, "$1\u2013").replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1\u2013");
    }
    if (token.type === "link_open" && token.info === "auto") inside_autolink--;
    if (token.type === "link_close" && token.info === "auto") inside_autolink++;
  }
}
function replace(state) {
  let blkIdx;
  if (!state.md.options.typographer) return;
  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline") continue;
    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) replace_scoped(state.tokens[blkIdx].children);
    if (RARE_RE.test(state.tokens[blkIdx].content)) replace_rare(state.tokens[blkIdx].children);
  }
}
var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var APOSTROPHE = "\u2019";
var MAX_OPENERS = 1e3;
function truncateStack(stack, heads, length) {
  while (stack.length > length) {
    const item = stack.pop();
    if (item.isSingleQuote) heads.single = item.prevSameQuoteIdx;
    else heads.double = item.prevSameQuoteIdx;
  }
}
function addReplacement(replacements, tokenIdx, pos, ch) {
  if (!replacements[tokenIdx]) replacements[tokenIdx] = [];
  replacements[tokenIdx].push({
    pos,
    ch
  });
}
function applyReplacements(str, replacements) {
  let result = "";
  let lastPos = 0;
  replacements.sort((a, b) => a.pos - b.pos);
  for (let i = 0; i < replacements.length; i++) {
    const replacement = replacements[i];
    result += str.slice(lastPos, replacement.pos) + replacement.ch;
    lastPos = replacement.pos + 1;
  }
  return result + str.slice(lastPos);
}
function process_inlines(tokens, state) {
  let j;
  const stack = [];
  const heads = {
    single: -1,
    double: -1
  };
  const replacements = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const thisLevel = tokens[i].level;
    for (j = stack.length - 1; j >= 0; j--) if (stack[j].level <= thisLevel) break;
    truncateStack(stack, heads, j + 1);
    if (token.type !== "text") continue;
    const text2 = token.content;
    let pos = 0;
    const max = text2.length;
    OUTER: while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      const t = QUOTE_RE.exec(text2);
      if (!t) break;
      let canOpen = true;
      let canClose = true;
      pos = t.index + 1;
      const isSingle = t[0] === "'";
      let lastChar = 32;
      if (t.index - 1 >= 0) lastChar = text2.charCodeAt(t.index - 1);
      else for (j = i - 1; j >= 0; j--) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
        break;
      }
      let nextChar = 32;
      if (pos < max) nextChar = text2.charCodeAt(pos);
      else for (j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
        if (!tokens[j].content) continue;
        nextChar = tokens[j].content.charCodeAt(0);
        break;
      }
      const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
      const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
      const isLastWhiteSpace = isWhiteSpace(lastChar);
      const isNextWhiteSpace = isWhiteSpace(nextChar);
      if (isNextWhiteSpace) canOpen = false;
      else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) canOpen = false;
      }
      if (isLastWhiteSpace) canClose = false;
      else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) canClose = false;
      }
      if (nextChar === 34 && t[0] === '"') {
        if (lastChar >= 48 && lastChar <= 57) canClose = canOpen = false;
      }
      if (canOpen && canClose) {
        canOpen = isLastPunctChar;
        canClose = isNextPunctChar;
      }
      if (!canOpen && !canClose) {
        if (isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
        continue;
      }
      if (canClose) {
        j = isSingle ? heads.single : heads.double;
        if (j >= 0 && stack[j].level === thisLevel) {
          const item = stack[j];
          let openQuote;
          let closeQuote;
          if (isSingle) {
            openQuote = state.md.options.quotes[2];
            closeQuote = state.md.options.quotes[3];
          } else {
            openQuote = state.md.options.quotes[0];
            closeQuote = state.md.options.quotes[1];
          }
          addReplacement(replacements, i, t.index, closeQuote);
          addReplacement(replacements, item.tokenIdx, item.contentPos, openQuote);
          truncateStack(stack, heads, j);
          continue OUTER;
        }
      }
      if (canOpen) {
        if (stack.length >= MAX_OPENERS) return;
        stack.push({
          tokenIdx: i,
          contentPos: t.index,
          isSingleQuote: isSingle,
          level: thisLevel,
          prevSameQuoteIdx: isSingle ? heads.single : heads.double
        });
        if (isSingle) heads.single = stack.length - 1;
        else heads.double = stack.length - 1;
      } else if (canClose && isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
    }
  }
  Object.keys(replacements).forEach(function(tokenIdx) {
    const idx = Number(tokenIdx);
    tokens[idx].content = applyReplacements(tokens[idx].content, replacements[tokenIdx]);
  });
}
function smartquotes(state) {
  if (!state.md.options.typographer) return;
  for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
    if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) continue;
    process_inlines(state.tokens[blkIdx].children, state);
  }
}
function join_alt(tokens) {
  let curr, last;
  const max = tokens.length;
  for (curr = 0; curr < max; curr++) if (tokens[curr].type === "text_special") tokens[curr].type = "text";
  for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
  else {
    if (curr !== last) tokens[last] = tokens[curr];
    last++;
  }
  if (curr !== last) tokens.length = last;
}
function text_join(state) {
  let curr, last;
  const blockTokens = state.tokens;
  const l = blockTokens.length;
  for (let j = 0; j < l; j++) {
    if (blockTokens[j].type !== "inline") continue;
    const tokens = blockTokens[j].children;
    const max = tokens.length;
    for (curr = 0; curr < max; curr++) {
      if (tokens[curr].type === "text_special") tokens[curr].type = "text";
      if (tokens[curr].children) join_alt(tokens[curr].children);
    }
    for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
    if (curr !== last) tokens.length = last;
  }
}
var _rules$2 = [
  ["normalize", normalize],
  ["block", block],
  ["strip_references", strip_references],
  ["inline", inline],
  ["linkify", linkify$1],
  ["replacements", replace],
  ["smartquotes", smartquotes],
  ["text_join", text_join]
];
var ParserCore = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of core rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(this, "State", StateCore);
    for (let i = 0; i < _rules$2.length; i++) this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
  }
  /**
  * Executes core chain rules.
  */
  process(state) {
    const rules = this.ruler.getRules("");
    for (let i = 0, l = rules.length; i < l; i++) rules[i](state);
  }
};
var StateBlock = class {
  constructor(src, md, env, tokens) {
    _defineProperty(this, "bMarks", []);
    _defineProperty(this, "eMarks", []);
    _defineProperty(this, "tShift", []);
    _defineProperty(this, "sCount", []);
    _defineProperty(this, "bsCount", []);
    _defineProperty(this, "blkIndent", 0);
    _defineProperty(this, "line", 0);
    _defineProperty(this, "lineMax", 0);
    _defineProperty(this, "tight", false);
    _defineProperty(this, "listIndent", -1);
    _defineProperty(this, "parentType", "root");
    _defineProperty(this, "level", 0);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.md = md;
    this.env = env;
    this.tokens = tokens;
    const s = this.src;
    for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
      const ch = s.charCodeAt(pos);
      if (!indent_found) {
        if (isSpace(ch)) {
          indent++;
          if (ch === 9) offset += 4 - offset % 4;
          else offset++;
          continue;
        } else indent_found = true;
      }
      if (ch === 10 || pos === len - 1) {
        if (ch !== 10) pos++;
        this.bMarks.push(start);
        this.eMarks.push(pos);
        this.tShift.push(indent);
        this.sCount.push(offset);
        this.bsCount.push(0);
        indent_found = false;
        indent = 0;
        offset = 0;
        start = pos + 1;
      }
    }
    this.bMarks.push(s.length);
    this.eMarks.push(s.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);
    this.lineMax = this.bMarks.length - 1;
  }
  push(type, tag, nesting) {
    const token = new Token(type, tag, nesting);
    token.block = true;
    if (nesting < 0) this.level--;
    token.level = this.level;
    if (nesting > 0) this.level++;
    this.tokens.push(token);
    return token;
  }
  isEmpty(line) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  }
  skipEmptyLines(from) {
    for (let max = this.lineMax; from < max; from++) if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) break;
    return from;
  }
  skipSpaces(pos) {
    for (let max = this.src.length; pos < max; pos++) if (!isSpace(this.src.charCodeAt(pos))) break;
    return pos;
  }
  skipSpacesBack(pos, min) {
    if (pos <= min) return pos;
    while (pos > min) if (!isSpace(this.src.charCodeAt(--pos))) return pos + 1;
    return pos;
  }
  skipChars(pos, code2) {
    for (let max = this.src.length; pos < max; pos++) if (this.src.charCodeAt(pos) !== code2) break;
    return pos;
  }
  skipCharsBack(pos, code2, min) {
    if (pos <= min) return pos;
    while (pos > min) if (code2 !== this.src.charCodeAt(--pos)) return pos + 1;
    return pos;
  }
  getLines(begin, end, indent, keepLastLF) {
    if (begin >= end) return "";
    const queue = new Array(end - begin);
    for (let i = 0, line = begin; line < end; line++, i++) {
      let lineIndent = 0;
      const lineStart = this.bMarks[line];
      let first = lineStart;
      let last;
      if (line + 1 < end || keepLastLF) last = this.eMarks[line] + 1;
      else last = this.eMarks[line];
      while (first < last && lineIndent < indent) {
        const ch = this.src.charCodeAt(first);
        if (isSpace(ch)) {
          if (ch === 9) lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
          else lineIndent++;
        } else if (first - lineStart < this.tShift[line]) lineIndent++;
        else break;
        first++;
      }
      if (lineIndent > indent) queue[i] = new Array(lineIndent - indent + 1).join(" ") + this.src.slice(first, last);
      else queue[i] = this.src.slice(first, last);
    }
    return queue.join("");
  }
};
var MAX_AUTOCOMPLETED_CELLS = 65536;
function getLine(state, line) {
  const pos = state.bMarks[line] + state.tShift[line];
  const max = state.eMarks[line];
  return state.src.slice(pos, max);
}
function escapedSplit(str) {
  const result = [];
  const max = str.length;
  let pos = 0;
  let ch = str.charCodeAt(pos);
  let isEscaped = false;
  let lastPos = 0;
  let current = "";
  while (pos < max) {
    if (ch === 124) {
      if (!isEscaped) {
        result.push(current + str.substring(lastPos, pos));
        current = "";
        lastPos = pos + 1;
      } else {
        current += str.substring(lastPos, pos - 1);
        lastPos = pos;
      }
    }
    isEscaped = ch === 92;
    pos++;
    ch = str.charCodeAt(pos);
  }
  result.push(current + str.substring(lastPos));
  return result;
}
function table(state, startLine, endLine, silent) {
  if (startLine + 2 > endLine) return false;
  let nextLine = startLine + 1;
  if (state.sCount[nextLine] < state.blkIndent) return false;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) return false;
  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58) return false;
  if (pos >= state.eMarks[nextLine]) return false;
  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh)) return false;
  if (firstCh === 45 && isSpace(secondCh)) return false;
  while (pos < state.eMarks[nextLine]) {
    const ch = state.src.charCodeAt(pos);
    if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch)) return false;
    pos++;
  }
  let lineText = getLine(state, startLine + 1);
  let columns = lineText.split("|");
  const aligns = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i].trim();
    if (!t) {
      if (i === 0 || i === columns.length - 1) continue;
      else return false;
    }
    if (!/^:?-+:?$/.test(t)) return false;
    if (t.charCodeAt(t.length - 1) === 58) aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
    else if (t.charCodeAt(0) === 58) aligns.push("left");
    else aligns.push("");
  }
  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf("|") === -1) return false;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  columns = escapedSplit(lineText);
  if (columns.length && columns[0] === "") columns.shift();
  if (columns.length && columns[columns.length - 1] === "") columns.pop();
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length) return false;
  if (silent) return true;
  const oldParentType = state.parentType;
  state.parentType = "table";
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const token_to = state.push("table_open", "table", 1);
  const tableLines = [startLine, 0];
  token_to.map = tableLines;
  const token_tho = state.push("thead_open", "thead", 1);
  token_tho.map = [startLine, startLine + 1];
  const token_htro = state.push("tr_open", "tr", 1);
  token_htro.map = [startLine, startLine + 1];
  for (let i = 0; i < columns.length; i++) {
    const token_ho = state.push("th_open", "th", 1);
    if (aligns[i]) token_ho.attrs = [["style", `text-align:${aligns[i]}`]];
    const token_il = state.push("inline", "", 0);
    token_il.content = columns[i].trim();
    token_il.children = [];
    state.push("th_close", "th", -1);
  }
  state.push("tr_close", "tr", -1);
  state.push("thead_close", "thead", -1);
  let tbodyLines;
  let autocompletedCells = 0;
  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    lineText = getLine(state, nextLine).trim();
    if (!lineText) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    columns = escapedSplit(lineText);
    if (columns.length && columns[0] === "") columns.shift();
    if (columns.length && columns[columns.length - 1] === "") columns.pop();
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) break;
    if (nextLine === startLine + 2) {
      const token_tbo = state.push("tbody_open", "tbody", 1);
      token_tbo.map = tbodyLines = [startLine + 2, 0];
    }
    const token_tro = state.push("tr_open", "tr", 1);
    token_tro.map = [nextLine, nextLine + 1];
    for (let i = 0; i < columnCount; i++) {
      const token_tdo = state.push("td_open", "td", 1);
      if (aligns[i]) token_tdo.attrs = [["style", `text-align:${aligns[i]}`]];
      const token_il = state.push("inline", "", 0);
      token_il.content = columns[i] ? columns[i].trim() : "";
      token_il.children = [];
      state.push("td_close", "td", -1);
    }
    state.push("tr_close", "tr", -1);
  }
  if (tbodyLines) {
    state.push("tbody_close", "tbody", -1);
    tbodyLines[1] = nextLine;
  }
  state.push("table_close", "table", -1);
  tableLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}
function code(state, startLine, endLine) {
  if (state.sCount[startLine] - state.blkIndent < 4) return false;
  let nextLine = startLine + 1;
  let last = nextLine;
  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }
  state.line = last;
  const token = state.push("code_block", "code", 0);
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + "\n";
  token.map = [startLine, state.line];
  return true;
}
function fence(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (pos + 3 > max) return false;
  const marker = state.src.charCodeAt(pos);
  if (marker !== 126 && marker !== 96) return false;
  let mem = pos;
  pos = state.skipChars(pos, marker);
  let len = pos - mem;
  if (len < 3) return false;
  const markup = state.src.slice(mem, pos);
  const params = state.src.slice(pos, max);
  if (marker === 96) {
    if (params.indexOf(String.fromCharCode(marker)) >= 0) return false;
  }
  if (silent) return true;
  let nextLine = startLine;
  let haveEndMarker = false;
  for (; ; ) {
    nextLine++;
    if (nextLine >= endLine) break;
    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
    if (state.src.charCodeAt(pos) !== marker) continue;
    if (state.sCount[nextLine] - state.blkIndent >= 4) continue;
    pos = state.skipChars(pos, marker);
    if (pos - mem < len) continue;
    pos = state.skipSpaces(pos);
    if (pos < max) continue;
    haveEndMarker = true;
    break;
  }
  len = state.sCount[startLine];
  state.line = nextLine + (haveEndMarker ? 1 : 0);
  const token = state.push("fence", "code", 0);
  token.info = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup = markup;
  token.map = [startLine, state.line];
  return true;
}
function blockquote(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  const oldLineMax = state.lineMax;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (state.src.charCodeAt(pos) !== 62) return false;
  if (silent) return true;
  const oldBMarks = [];
  const oldBSCount = [];
  const oldSCount = [];
  const oldTShift = [];
  const terminatorRules = state.md.block.ruler.getRules("blockquote");
  const oldParentType = state.parentType;
  state.parentType = "blockquote";
  let lastLineEmpty = false;
  let nextLine;
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    const isOutdented = state.sCount[nextLine] < state.blkIndent;
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    if (pos >= max) break;
    if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
      let initial = state.sCount[nextLine] + 1;
      let spaceAfterMarker;
      let adjustTab;
      if (state.src.charCodeAt(pos) === 32) {
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 9) {
        spaceAfterMarker = true;
        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          pos++;
          initial++;
          adjustTab = false;
        } else adjustTab = true;
      } else spaceAfterMarker = false;
      let offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;
      while (pos < max) {
        const ch = state.src.charCodeAt(pos);
        if (isSpace(ch)) {
          if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
          else offset++;
        } else break;
        pos++;
      }
      lastLineEmpty = pos >= max;
      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;
      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }
    if (lastLineEmpty) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) {
      state.lineMax = nextLine;
      if (state.blkIndent !== 0) {
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }
      break;
    }
    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);
    state.sCount[nextLine] = -1;
  }
  const oldIndent = state.blkIndent;
  state.blkIndent = 0;
  const token_o = state.push("blockquote_open", "blockquote", 1);
  token_o.markup = ">";
  const lines = [startLine, 0];
  token_o.map = lines;
  state.md.block.tokenize(state, startLine, nextLine);
  const token_c = state.push("blockquote_close", "blockquote", -1);
  token_c.markup = ">";
  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;
  for (let i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;
  return true;
}
function hr(state, startLine, endLine, silent) {
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 95) return false;
  let cnt = 1;
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch)) return false;
    if (ch === marker) cnt++;
  }
  if (cnt < 3) return false;
  if (silent) return true;
  state.line = startLine + 1;
  const token = state.push("hr", "hr", 0);
  token.map = [startLine, state.line];
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker));
  return true;
}
function skipBulletListMarker(state, startLine) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);
  if (marker !== 42 && marker !== 45 && marker !== 43) return -1;
  if (pos < max) {
    if (!isSpace(state.src.charCodeAt(pos))) return -1;
  }
  return pos;
}
function skipOrderedListMarker(state, startLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;
  if (pos + 1 >= max) return -1;
  let ch = state.src.charCodeAt(pos++);
  if (ch < 48 || ch > 57) return -1;
  for (; ; ) {
    if (pos >= max) return -1;
    ch = state.src.charCodeAt(pos++);
    if (ch >= 48 && ch <= 57) {
      if (pos - start >= 10) return -1;
      continue;
    }
    if (ch === 41 || ch === 46) break;
    return -1;
  }
  if (pos < max) {
    ch = state.src.charCodeAt(pos);
    if (!isSpace(ch)) return -1;
  }
  return pos;
}
function markTightParagraphs(state, idx) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
    state.tokens[i + 2].hidden = true;
    state.tokens[i].hidden = true;
    i += 2;
  }
}
function list(state, startLine, endLine, silent) {
  let max, pos, start, token;
  let nextLine = startLine;
  let tight = true;
  if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
  if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent) return false;
  let isTerminatingParagraph = false;
  if (silent && state.parentType === "paragraph") {
    if (state.sCount[nextLine] >= state.blkIndent) isTerminatingParagraph = true;
  }
  let isOrdered;
  let markerValue;
  let posAfterMarker;
  if ((posAfterMarker = skipOrderedListMarker(state, nextLine)) >= 0) {
    isOrdered = true;
    start = state.bMarks[nextLine] + state.tShift[nextLine];
    markerValue = Number(state.src.slice(start, posAfterMarker - 1));
    if (isTerminatingParagraph && markerValue !== 1) return false;
  } else if ((posAfterMarker = skipBulletListMarker(state, nextLine)) >= 0) isOrdered = false;
  else return false;
  if (isTerminatingParagraph) {
    if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false;
  }
  if (silent) return true;
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
  const listTokIdx = state.tokens.length;
  if (isOrdered) {
    token = state.push("ordered_list_open", "ol", 1);
    if (markerValue !== 1) token.attrs = [["start", markerValue]];
  } else token = state.push("bullet_list_open", "ul", 1);
  const listLines = [nextLine, 0];
  token.map = listLines;
  token.markup = String.fromCharCode(markerCharCode);
  let prevEmptyEnd = false;
  const terminatorRules = state.md.block.ruler.getRules("list");
  const oldParentType = state.parentType;
  state.parentType = "list";
  while (nextLine < endLine) {
    pos = posAfterMarker;
    max = state.eMarks[nextLine];
    const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
    let offset = initial;
    while (pos < max) {
      const ch = state.src.charCodeAt(pos);
      if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine]) % 4;
      else if (ch === 32) offset++;
      else break;
      pos++;
    }
    const contentStart = pos;
    let indentAfterMarker;
    if (contentStart >= max) indentAfterMarker = 1;
    else indentAfterMarker = offset - initial;
    if (indentAfterMarker > 4) indentAfterMarker = 1;
    const indent = initial + indentAfterMarker;
    token = state.push("list_item_open", "li", 1);
    token.markup = String.fromCharCode(markerCharCode);
    const itemLines2 = [nextLine, 0];
    token.map = itemLines2;
    if (isOrdered) token.info = state.src.slice(start, posAfterMarker - 1);
    const oldTight = state.tight;
    const oldTShift = state.tShift[nextLine];
    const oldSCount = state.sCount[nextLine];
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;
    state.tight = true;
    state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
    state.sCount[nextLine] = offset;
    if (contentStart >= max && state.isEmpty(nextLine + 1)) state.line = Math.min(state.line + 2, endLine);
    else state.md.block.tokenize(state, nextLine, endLine);
    if (!state.tight || prevEmptyEnd) tight = false;
    prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[nextLine] = oldTShift;
    state.sCount[nextLine] = oldSCount;
    state.tight = oldTight;
    token = state.push("list_item_close", "li", -1);
    token.markup = String.fromCharCode(markerCharCode);
    nextLine = state.line;
    itemLines2[1] = nextLine;
    if (nextLine >= endLine) break;
    if (state.sCount[nextLine] < state.blkIndent) break;
    if (state.sCount[nextLine] - state.blkIndent >= 4) break;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
      start = state.bMarks[nextLine] + state.tShift[nextLine];
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) break;
    }
    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) break;
  }
  if (isOrdered) token = state.push("ordered_list_close", "ol", -1);
  else token = state.push("bullet_list_close", "ul", -1);
  token.markup = String.fromCharCode(markerCharCode);
  listLines[1] = nextLine;
  state.line = nextLine;
  state.parentType = oldParentType;
  if (tight) markTightParagraphs(state, listTokIdx);
  return true;
}
var MAX_LABEL_LENGTH = 999;
function countCodePoints(str) {
  let length = str.length;
  for (let i = 0; i < str.length - 1; i++) {
    const high = str.charCodeAt(i);
    if (high < 55296 || high > 56319) continue;
    const low = str.charCodeAt(i + 1);
    if (low >= 56320 && low <= 57343) {
      length--;
      i++;
    }
  }
  return length;
}
function lineEnd(state, line) {
  return Math.min(state.eMarks[line] + 1, state.src.length);
}
function getNextLinePos(state, nextLine) {
  const endLine = state.lineMax;
  if (nextLine >= endLine || state.isEmpty(nextLine)) return -1;
  let isContinuation = false;
  if (state.sCount[nextLine] - state.blkIndent > 3) isContinuation = true;
  if (state.sCount[nextLine] < 0) isContinuation = true;
  if (!isContinuation) {
    const terminatorRules = state.md.block.ruler.getRules("reference");
    const oldParentType = state.parentType;
    state.parentType = "reference";
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    state.parentType = oldParentType;
    if (terminate) return -1;
  }
  return state.bMarks[nextLine] + state.tShift[nextLine];
}
function reference(state, startLine, _endLine, silent) {
  const src = state.src;
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let nextLine = startLine + 1;
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (src.charCodeAt(pos) !== 91) return false;
  let max = lineEnd(state, startLine);
  let rawLabel = "";
  let labelEnd = -1;
  let segmentStart = ++pos;
  while (pos < max) {
    if (rawLabel.length + pos - segmentStart > MAX_LABEL_LENGTH * 2) return false;
    let ch = src.charCodeAt(pos);
    if (ch === 91) return false;
    if (ch === 93) {
      labelEnd = pos;
      break;
    }
    if (ch === 92) ch = src.charCodeAt(++pos);
    if (ch === 10 && pos < max) {
      const nextPos = getNextLinePos(state, nextLine);
      if (nextPos < 0) return false;
      rawLabel += src.slice(segmentStart, max);
      pos = segmentStart = nextPos;
      max = lineEnd(state, nextLine++);
      continue;
    }
    pos++;
  }
  if (labelEnd < 0 || src.charCodeAt(labelEnd + 1) !== 58) return false;
  rawLabel += src.slice(segmentStart, labelEnd);
  if (rawLabel.length > MAX_LABEL_LENGTH && countCodePoints(rawLabel) > MAX_LABEL_LENGTH) return false;
  pos = labelEnd + 2;
  while (pos < max) {
    const ch = src.charCodeAt(pos);
    if (ch === 10) {
      const nextPos = getNextLinePos(state, nextLine);
      if (nextPos < 0) break;
      pos = nextPos;
      max = lineEnd(state, nextLine++);
    } else if (isSpace(ch)) pos++;
    else break;
  }
  const destRes = state.md.helpers.parseLinkDestination(src, pos, max);
  if (!destRes.ok) return false;
  const href = state.md.normalizeLink(destRes.str);
  if (!state.md.validateLink(href)) return false;
  pos = destRes.pos;
  const destEndPos = pos;
  const destEndMax = max;
  const destEndLineNo = nextLine;
  while (pos < max) {
    const ch = src.charCodeAt(pos);
    if (ch === 10) {
      const nextPos = getNextLinePos(state, nextLine);
      if (nextPos < 0) break;
      pos = nextPos;
      max = lineEnd(state, nextLine++);
    } else if (isSpace(ch)) pos++;
    else break;
  }
  const titleStart = pos;
  let titleRes = state.md.helpers.parseLinkTitle(src, pos, max);
  while (titleRes.can_continue) {
    const nextPos = getNextLinePos(state, nextLine);
    if (nextPos < 0) break;
    pos = nextPos;
    max = lineEnd(state, nextLine++);
    titleRes = state.md.helpers.parseLinkTitle(src, pos, max, titleRes);
  }
  let title;
  if (titleStart !== destEndPos && titleRes.ok) {
    title = titleRes.str;
    pos = titleRes.pos;
  } else {
    title = "";
    pos = destEndPos;
    max = destEndMax;
    nextLine = destEndLineNo;
  }
  while (pos < max) {
    if (!isSpace(src.charCodeAt(pos))) break;
    pos++;
  }
  if (pos < max && src.charCodeAt(pos) !== 10) {
    if (title) {
      title = "";
      pos = destEndPos;
      max = destEndMax;
      nextLine = destEndLineNo;
      while (pos < max) {
        if (!isSpace(src.charCodeAt(pos))) break;
        pos++;
      }
    }
  }
  if (pos < max && src.charCodeAt(pos) !== 10) return false;
  const label = normalizeReference(rawLabel);
  if (!label) return false;
  if (silent) return true;
  if (typeof state.env.references === "undefined") state.env.references = {};
  if (typeof state.env.references[label] === "undefined") state.env.references[label] = {
    title,
    href
  };
  const token = state.push("reference_definition", "", 0);
  token.map = [startLine, nextLine];
  token.hidden = true;
  const meta = /* @__PURE__ */ Object.create(null);
  meta.label = label;
  token.meta = meta;
  state.line = nextLine;
  return true;
}
var html_blocks_default = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var open_tag = `<[A-Za-z][A-Za-z0-9\\-]*(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*"))?)*\\s*\\/?>`;
var close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
new RegExp(`^(?:${open_tag}|${close_tag}|<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->|<[?][\\s\\S]*?[?]>|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`);
var HTML_OPEN_CLOSE_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag})`);
var HTML_SEQUENCES = [
  [
    /^<(script|pre|style|textarea)(?=(\s|>|$))/i,
    /<\/(script|pre|style|textarea)>/i,
    true
  ],
  [
    /^<!--/,
    /-->/,
    true
  ],
  [
    /^<\?/,
    /\?>/,
    true
  ],
  [
    /^<![A-Za-z]/,
    />/,
    true
  ],
  [
    /^<!\[CDATA\[/,
    /\]\]>/,
    true
  ],
  [
    new RegExp(`^</?(${html_blocks_default.join("|")})(?=(\\s|/?>|$))`, "i"),
    /^$/,
    true
  ],
  [
    new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`),
    /^$/,
    false
  ]
];
function html_block(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (!state.md.options.html) return false;
  if (state.src.charCodeAt(pos) !== 60) return false;
  let lineText = state.src.slice(pos, max);
  let i = 0;
  for (; i < HTML_SEQUENCES.length; i++) if (HTML_SEQUENCES[i][0].test(lineText)) break;
  if (i === HTML_SEQUENCES.length) return false;
  if (silent) return HTML_SEQUENCES[i][2];
  let nextLine = startLine + 1;
  const endsOnBlankLine = HTML_SEQUENCES[i][1].test("");
  if (!HTML_SEQUENCES[i][1].test(lineText)) for (; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) {
      if (endsOnBlankLine || !state.isEmpty(nextLine)) break;
    }
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];
    lineText = state.src.slice(pos, max);
    if (HTML_SEQUENCES[i][1].test(lineText)) {
      if (lineText.length !== 0) nextLine++;
      break;
    }
  }
  state.line = nextLine;
  const token = state.push("html_block", "", 0);
  token.map = [startLine, nextLine];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
  return true;
}
function heading(state, startLine, endLine, silent) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  let ch = state.src.charCodeAt(pos);
  if (ch !== 35 || pos >= max) return false;
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 35 && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }
  if (level > 6 || pos < max && !isSpace(ch)) return false;
  if (silent) return true;
  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 35, pos);
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) max = tmp;
  state.line = startLine + 1;
  const token_o = state.push("heading_open", `h${level}`, 1);
  token_o.markup = "########".slice(0, level);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = asciiTrim(state.src.slice(pos, max));
  token_i.map = [startLine, state.line];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${level}`, -1);
  token_c.markup = "########".slice(0, level);
  return true;
}
function lheading(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const oldParentType = state.parentType;
  state.parentType = "paragraph";
  let level = 0;
  let marker;
  let nextLine = startLine + 1;
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] >= state.blkIndent) {
      let pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];
      if (pos < max) {
        marker = state.src.charCodeAt(pos);
        if (marker === 45 || marker === 61) {
          pos = state.skipChars(pos, marker);
          pos = state.skipSpaces(pos);
          if (pos >= max) {
            level = marker === 61 ? 1 : 2;
            break;
          }
        }
      }
    }
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  if (!level) {
    state.parentType = oldParentType;
    return false;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine + 1;
  const token_o = state.push("heading_open", `h${level}`, 1);
  token_o.markup = String.fromCharCode(marker);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line - 1];
  token_i.children = [];
  const token_c = state.push("heading_close", `h${level}`, -1);
  token_c.markup = String.fromCharCode(marker);
  state.parentType = oldParentType;
  return true;
}
function paragraph(state, startLine, endLine) {
  const terminatorRules = state.md.block.ruler.getRules("paragraph");
  const oldParentType = state.parentType;
  let nextLine = startLine + 1;
  state.parentType = "paragraph";
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    if (state.sCount[nextLine] - state.blkIndent > 3) continue;
    if (state.sCount[nextLine] < 0) continue;
    let terminate = false;
    for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
      terminate = true;
      break;
    }
    if (terminate) break;
  }
  const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
  state.line = nextLine;
  const token_o = state.push("paragraph_open", "p", 1);
  token_o.map = [startLine, state.line];
  const token_i = state.push("inline", "", 0);
  token_i.content = content;
  token_i.map = [startLine, state.line];
  token_i.children = [];
  state.push("paragraph_close", "p", -1);
  state.parentType = oldParentType;
  return true;
}
var _rules$1 = [
  [
    "table",
    table,
    ["paragraph", "reference"]
  ],
  ["code", code],
  [
    "fence",
    fence,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "blockquote",
    blockquote,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "hr",
    hr,
    [
      "paragraph",
      "reference",
      "blockquote",
      "list"
    ]
  ],
  [
    "list",
    list,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["reference", reference],
  [
    "html_block",
    html_block,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  [
    "heading",
    heading,
    [
      "paragraph",
      "reference",
      "blockquote"
    ]
  ],
  ["lheading", lheading],
  ["paragraph", paragraph]
];
var ParserBlock = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of block rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(this, "State", StateBlock);
    for (let i = 0; i < _rules$1.length; i++) this.ruler.push(_rules$1[i][0], _rules$1[i][1], { alt: (_rules$1[i][2] || []).slice() });
  }
  tokenize(state, startLine, endLine) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    let line = startLine;
    let hasEmptyLines = false;
    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) break;
      if (state.sCount[line] < state.blkIndent) break;
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }
      const prevLine = state.line;
      let ok = false;
      for (let i = 0; i < len; i++) {
        ok = rules[i](state, line, endLine, false);
        if (ok) {
          if (prevLine >= state.line) throw new Error("block rule didn't increment state.line");
          break;
        }
      }
      if (!ok) throw new Error("none of the block rules matched");
      state.tight = !hasEmptyLines;
      if (state.isEmpty(state.line - 1)) hasEmptyLines = true;
      line = state.line;
      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  }
  /**
  * Process input string and push block tokens into `outTokens`
  */
  parse(src, md, env, outTokens) {
    if (!src) return;
    const state = new this.State(src, md, env, outTokens);
    this.tokenize(state, state.line, state.lineMax);
  }
};
var StateInline = class {
  constructor(src, md, env, outTokens) {
    _defineProperty(this, "pos", 0);
    _defineProperty(this, "level", 0);
    _defineProperty(this, "pending", "");
    _defineProperty(this, "pendingLevel", 0);
    _defineProperty(this, "cache", {});
    _defineProperty(this, "backticks", {});
    _defineProperty(this, "backticksScanned", false);
    _defineProperty(this, "skipHtmlSpecial", false);
    _defineProperty(this, "linkLevel", 0);
    _defineProperty(this, "delimiters", []);
    _defineProperty(this, "_prev_delimiters", []);
    _defineProperty(this, "Token", Token);
    this.src = src;
    this.env = env;
    this.md = md;
    this.tokens = outTokens;
    this.tokens_meta = Array(outTokens.length);
    this.posMax = this.src.length;
  }
  pushPending() {
    const token = new Token("text", "", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  }
  push(type, tag, nesting) {
    if (this.pending) this.pushPending();
    const token = new Token(type, tag, nesting);
    let token_meta = void 0;
    if (nesting < 0) {
      this.level--;
      this.delimiters = this._prev_delimiters.pop();
    }
    token.level = this.level;
    if (nesting > 0) {
      this.level++;
      this._prev_delimiters.push(this.delimiters);
      this.delimiters = [];
      token_meta = { delimiters: this.delimiters };
    }
    this.pendingLevel = this.level;
    this.tokens.push(token);
    this.tokens_meta.push(token_meta);
    return token;
  }
  scanDelims(start, canSplitWord) {
    const max = this.posMax;
    const marker = this.src.charCodeAt(start);
    let lastChar;
    if (start === 0) lastChar = 32;
    else if (start === 1) {
      lastChar = this.src.charCodeAt(0);
      if ((lastChar & 63488) === 55296) lastChar = 65533;
    } else {
      lastChar = this.src.charCodeAt(start - 1);
      if ((lastChar & 64512) === 56320) {
        const highSurr = this.src.charCodeAt(start - 2);
        lastChar = (highSurr & 64512) === 55296 ? 65536 + (highSurr - 55296 << 10) + (lastChar - 56320) : 65533;
      } else if ((lastChar & 64512) === 55296) lastChar = 65533;
    }
    let pos = start;
    while (pos < max && this.src.charCodeAt(pos) === marker) pos++;
    const count = pos - start;
    let nextChar = pos < max ? this.src.charCodeAt(pos) : 32;
    if ((nextChar & 64512) === 55296) {
      const lowSurr = this.src.charCodeAt(pos + 1);
      nextChar = (lowSurr & 64512) === 56320 ? 65536 + (nextChar - 55296 << 10) + (lowSurr - 56320) : 65533;
    } else if ((nextChar & 64512) === 56320) nextChar = 65533;
    const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
    const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
    const isLastWhiteSpace = isWhiteSpace(lastChar);
    const isNextWhiteSpace = isWhiteSpace(nextChar);
    const left_flanking = !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
    const right_flanking = !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);
    return {
      can_open: left_flanking && (canSplitWord || !right_flanking || isLastPunctChar),
      can_close: right_flanking && (canSplitWord || !left_flanking || isNextPunctChar),
      length: count
    };
  }
};
function isTerminatorChar(ch) {
  switch (ch) {
    case 10:
    case 33:
    case 35:
    case 36:
    case 37:
    case 38:
    case 42:
    case 43:
    case 45:
    case 58:
    case 60:
    case 61:
    case 62:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 125:
    case 126:
      return true;
    default:
      return false;
  }
}
function text(state, silent) {
  let pos = state.pos;
  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) pos++;
  if (pos === state.pos) return false;
  if (!silent) state.pending += state.src.slice(state.pos, pos);
  state.pos = pos;
  return true;
}
function isAsciiAlpha(code2) {
  return code2 >= 65 && code2 <= 90 || code2 >= 97 && code2 <= 122;
}
function isSchemeChar(code2) {
  return code2 >= 65 && code2 <= 90 || code2 >= 97 && code2 <= 122 || code2 >= 48 && code2 <= 57 || code2 === 43 || code2 === 45 || code2 === 46;
}
function linkify(state, silent) {
  if (!state.md.options.linkify) return false;
  if (state.linkLevel > 0) return false;
  const pos = state.pos;
  const max = state.posMax;
  if (pos + 3 > max) return false;
  if (state.src.charCodeAt(pos) !== 58) return false;
  if (state.src.charCodeAt(pos + 1) !== 47) return false;
  if (state.src.charCodeAt(pos + 2) !== 47) return false;
  const protoMin = pos - Math.min(10, state.pending.length, pos);
  let protoStart = pos;
  while (protoStart > protoMin && isSchemeChar(state.src.charCodeAt(protoStart - 1))) protoStart--;
  if (protoStart === pos || !isAsciiAlpha(state.src.charCodeAt(protoStart))) return false;
  const protoLength = pos - protoStart;
  const link2 = state.md.linkify.matchAtStart(state.src.slice(protoStart));
  if (!link2) return false;
  let url = link2.url;
  if (url.length <= protoLength) return false;
  let urlEnd = url.length;
  while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 42) urlEnd--;
  if (urlEnd !== url.length) url = url.slice(0, urlEnd);
  const fullUrl = state.md.normalizeLink(url);
  if (!state.md.validateLink(fullUrl)) return false;
  if (!silent) {
    state.pending = state.pending.slice(0, -protoLength);
    const token_o = state.push("link_open", "a", 1);
    token_o.attrs = [["href", fullUrl]];
    token_o.markup = "linkify";
    token_o.info = "auto";
    const token_t = state.push("text", "", 0);
    token_t.content = state.md.normalizeLinkText(url);
    const token_c = state.push("link_close", "a", -1);
    token_c.markup = "linkify";
    token_c.info = "auto";
  }
  state.pos += url.length - protoLength;
  return true;
}
function newline(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 10) return false;
  const pmax = state.pending.length - 1;
  const max = state.posMax;
  if (!silent) {
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) {
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
        let ws = pmax - 1;
        while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32) ws--;
        state.pending = state.pending.slice(0, ws);
        state.push("hardbreak", "br", 0);
      } else {
        state.pending = state.pending.slice(0, -1);
        state.push("softbreak", "br", 0);
      }
    } else state.push("softbreak", "br", 0);
  }
  pos++;
  while (pos < max && isSpace(state.src.charCodeAt(pos))) pos++;
  state.pos = pos;
  return true;
}
var ESCAPED = [];
for (let i = 0; i < 256; i++) ESCAPED.push(0);
"\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function(ch) {
  ESCAPED[ch.charCodeAt(0)] = 1;
});
function escape2(state, silent) {
  let pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 92) return false;
  pos++;
  if (pos >= max) return false;
  let ch1 = state.src.charCodeAt(pos);
  if (ch1 === 10) {
    if (!silent) state.push("hardbreak", "br", 0);
    pos++;
    while (pos < max) {
      ch1 = state.src.charCodeAt(pos);
      if (!isSpace(ch1)) break;
      pos++;
    }
    state.pos = pos;
    return true;
  }
  if (ch1 === 32) {
    if (!silent) {
      const token = state.push("text_special", "", 0);
      token.content = "\\";
      token.markup = "\\";
      token.info = "escape";
    }
    state.pos = pos;
    return true;
  }
  let escapedStr = state.src[pos];
  if (ch1 >= 55296 && ch1 <= 56319 && pos + 1 < max) {
    const ch2 = state.src.charCodeAt(pos + 1);
    if (ch2 >= 56320 && ch2 <= 57343) {
      escapedStr += state.src[pos + 1];
      pos++;
    }
  }
  const origStr = "\\" + escapedStr;
  if (!silent) {
    const token = state.push("text_special", "", 0);
    if (ch1 < 256 && ESCAPED[ch1] !== 0) token.content = escapedStr;
    else token.content = origStr;
    token.markup = origStr;
    token.info = "escape";
  }
  state.pos = pos + 1;
  return true;
}
function buildLastRuns(src) {
  const lastRuns = {};
  let pos = 0;
  while ((pos = src.indexOf("`", pos)) !== -1) {
    const start = pos;
    while (src.charCodeAt(++pos) === 96) ;
    lastRuns[pos - start] = start;
  }
  return lastRuns;
}
function backtick(state, silent) {
  var _state$backticks$open;
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 96) return false;
  const max = state.posMax;
  let pos = start + 1;
  while (pos < max && state.src.charCodeAt(pos) === 96) pos++;
  const marker = state.src.slice(start, pos);
  const openerLength = marker.length;
  if (!state.backticksScanned) {
    state.backticks = buildLastRuns(state.src);
    state.backticksScanned = true;
  }
  if (((_state$backticks$open = state.backticks[openerLength]) !== null && _state$backticks$open !== void 0 ? _state$backticks$open : -1) >= pos) {
    let matchEnd = pos;
    let matchStart;
    while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1 && matchStart < max) {
      matchEnd = matchStart + 1;
      while (state.src.charCodeAt(matchEnd) === 96) matchEnd++;
      if (matchEnd > max) break;
      if (matchEnd - matchStart === openerLength) {
        if (!silent) {
          const token = state.push("code_inline", "code", 0);
          token.markup = marker;
          let content = state.src.slice(pos, matchStart).replace(/\n/g, " ");
          if (content.startsWith(" ") && content.endsWith(" ") && /[^ ]/.test(content)) content = content.slice(1, -1);
          token.content = content;
        }
        state.pos = matchEnd;
        return true;
      }
    }
  }
  if (!silent) state.pending += marker;
  state.pos = pos;
  return true;
}
function strikethrough_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 126) return false;
  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);
  if (len < 2) return false;
  let token;
  if (len % 2) {
    token = state.push("text", "", 0);
    token.content = ch;
    len--;
  }
  for (let i = 0; i < len; i += 2) {
    token = state.push("text", "", 0);
    token.content = ch + ch;
    state.delimiters.push({
      marker,
      length: 0,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess$1(state, delimiters) {
  let token;
  const loneMarkers = [];
  const max = delimiters.length;
  for (let i = 0; i < max; i++) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 126) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    token = state.tokens[startDelim.token];
    token.type = "s_open";
    token.tag = "s";
    token.nesting = 1;
    token.markup = "~~";
    token.content = "";
    token = state.tokens[endDelim.token];
    token.type = "s_close";
    token.tag = "s";
    token.nesting = -1;
    token.markup = "~~";
    token.content = "";
    if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~") loneMarkers.push(endDelim.token - 1);
  }
  while (loneMarkers.length) {
    const i = loneMarkers.pop();
    let j = i + 1;
    while (j < state.tokens.length && state.tokens[j].type === "s_close") j++;
    j--;
    if (i !== j) {
      token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}
function strikethrough_postProcess(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess$1(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) postProcess$1(state, delimiters);
  }
}
var strikethrough_default = {
  tokenize: strikethrough_tokenize,
  postProcess: strikethrough_postProcess
};
function emphasis_tokenize(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (silent) return false;
  if (marker !== 95 && marker !== 42) return false;
  const scanned = state.scanDelims(state.pos, marker === 42);
  for (let i = 0; i < scanned.length; i++) {
    const token = state.push("text", "", 0);
    token.content = String.fromCharCode(marker);
    state.delimiters.push({
      marker,
      length: scanned.length,
      token: state.tokens.length - 1,
      end: -1,
      open: scanned.can_open,
      close: scanned.can_close
    });
  }
  state.pos += scanned.length;
  return true;
}
function postProcess(state, delimiters) {
  const max = delimiters.length;
  for (let i = max - 1; i >= 0; i--) {
    const startDelim = delimiters[i];
    if (startDelim.marker !== 95 && startDelim.marker !== 42) continue;
    if (startDelim.end === -1) continue;
    const endDelim = delimiters[startDelim.end];
    const isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1;
    const ch = String.fromCharCode(startDelim.marker);
    const token_o = state.tokens[startDelim.token];
    token_o.type = isStrong ? "strong_open" : "em_open";
    token_o.tag = isStrong ? "strong" : "em";
    token_o.nesting = 1;
    token_o.markup = isStrong ? ch + ch : ch;
    token_o.content = "";
    const token_c = state.tokens[endDelim.token];
    token_c.type = isStrong ? "strong_close" : "em_close";
    token_c.tag = isStrong ? "strong" : "em";
    token_c.nesting = -1;
    token_c.markup = isStrong ? ch + ch : ch;
    token_c.content = "";
    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = "";
      state.tokens[delimiters[startDelim.end + 1].token].content = "";
      i--;
    }
  }
}
function emphasis_post_process(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  postProcess(state, state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) postProcess(state, delimiters);
  }
}
var emphasis_default = {
  tokenize: emphasis_tokenize,
  postProcess: emphasis_post_process
};
function link(state, silent) {
  let code2, label, res, ref;
  let href = "";
  let title = "";
  let start = state.pos;
  let parseReference = true;
  if (state.src.charCodeAt(state.pos) !== 91) return false;
  const oldPos = state.pos;
  const max = state.posMax;
  const labelStart = state.pos + 1;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
  if (labelEnd < 0) return false;
  let pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    parseReference = false;
    pos++;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
      start = pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) break;
      }
      res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;
        for (; pos < max; pos++) {
          code2 = state.src.charCodeAt(pos);
          if (!isSpace(code2) && code2 !== 10) break;
        }
      }
    }
    if (pos >= max || state.src.charCodeAt(pos) !== 41) parseReference = true;
    pos++;
  }
  if (parseReference) {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    label = normalizeReference(label);
    ref = state.env.references[label];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;
    const token_o = state.push("link_open", "a", 1);
    const attrs = [["href", href]];
    token_o.attrs = attrs;
    if (title) attrs.push(["title", title]);
    if (label) {
      const meta = /* @__PURE__ */ Object.create(null);
      meta.label = label;
      token_o.meta = meta;
    }
    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;
    state.push("link_close", "a", -1);
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
function image(state, silent) {
  let code2, content, label, pos, ref, res, title, start;
  let href = "";
  const oldPos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(state.pos) !== 33) return false;
  if (state.src.charCodeAt(state.pos + 1) !== 91) return false;
  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
  if (labelEnd < 0) return false;
  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 40) {
    pos++;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    if (pos >= max) return false;
    start = pos;
    res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) pos = res.pos;
      else href = "";
    }
    start = pos;
    for (; pos < max; pos++) {
      code2 = state.src.charCodeAt(pos);
      if (!isSpace(code2) && code2 !== 10) break;
    }
    res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;
      for (; pos < max; pos++) {
        code2 = state.src.charCodeAt(pos);
        if (!isSpace(code2) && code2 !== 10) break;
      }
    } else title = "";
    if (pos >= max || state.src.charCodeAt(pos) !== 41) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    if (typeof state.env.references === "undefined") return false;
    if (pos < max && state.src.charCodeAt(pos) === 91) {
      start = pos + 1;
      pos = state.md.helpers.parseLinkLabel(state, pos);
      if (pos >= 0) label = state.src.slice(start, pos++);
      else pos = labelEnd + 1;
    } else pos = labelEnd + 1;
    if (!label) label = state.src.slice(labelStart, labelEnd);
    label = normalizeReference(label);
    ref = state.env.references[label];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }
  if (!silent) {
    content = state.src.slice(labelStart, labelEnd);
    const tokens = [];
    state.md.inline.parse(content, state.md, state.env, tokens);
    const token = state.push("image", "img", 0);
    const attrs = [["src", href], ["alt", ""]];
    token.attrs = attrs;
    token.children = tokens;
    token.content = content;
    if (title) attrs.push(["title", title]);
    if (label) {
      const meta = /* @__PURE__ */ Object.create(null);
      meta.label = label;
      token.meta = meta;
    }
  }
  state.pos = pos;
  state.posMax = max;
  return true;
}
var EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
var AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;
function autolink(state, silent) {
  let pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60) return false;
  const start = state.pos;
  const max = state.posMax;
  for (; ; ) {
    if (++pos >= max) return false;
    const ch = state.src.charCodeAt(pos);
    if (ch === 60) return false;
    if (ch === 62) break;
  }
  const url = state.src.slice(start + 1, pos);
  if (AUTOLINK_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  if (EMAIL_RE.test(url)) {
    const fullUrl = state.md.normalizeLink(`mailto:${url}`);
    if (!state.md.validateLink(fullUrl)) return false;
    if (!silent) {
      const token_o = state.push("link_open", "a", 1);
      token_o.attrs = [["href", fullUrl]];
      token_o.markup = "autolink";
      token_o.info = "auto";
      const token_t = state.push("text", "", 0);
      token_t.content = state.md.normalizeLinkText(url);
      const token_c = state.push("link_close", "a", -1);
      token_c.markup = "autolink";
      token_c.info = "auto";
    }
    state.pos += url.length + 2;
    return true;
  }
  return false;
}
function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}
function isLetter(ch) {
  const lc = ch | 32;
  return lc >= 97 && lc <= 122;
}
function scanSpecial(state, pos) {
  const src = state.src;
  let start;
  let terminator;
  if (src.startsWith("<!--", pos)) {
    if (src.startsWith(">", pos + 4)) return pos + 5;
    if (src.startsWith("->", pos + 4)) return pos + 6;
    start = pos + 4;
    terminator = "-->";
  } else if (src.startsWith("<![CDATA[", pos)) {
    start = pos + 9;
    terminator = "]]>";
  } else if (src.charCodeAt(pos + 1) === 63) {
    start = pos + 2;
    terminator = "?>";
  } else if (isLetter(src.charCodeAt(pos + 2))) {
    start = pos + 3;
    terminator = ">";
  } else return -1;
  if (state.skipHtmlSpecial) return -1;
  const end = src.indexOf(terminator, start);
  if (end < 0) {
    state.skipHtmlSpecial = true;
    return -1;
  }
  return end + terminator.length;
}
function html_inline(state, silent) {
  if (!state.md.options.html) return false;
  const max = state.posMax;
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) return false;
  let end;
  const ch = state.src.charCodeAt(pos + 1);
  if (ch === 33 || ch === 63) end = scanSpecial(state, pos);
  else if (ch === 47 || isLetter(ch)) {
    const match = state.src.slice(pos).match(HTML_OPEN_CLOSE_TAG_RE);
    end = match ? pos + match[0].length : -1;
  } else return false;
  if (end < 0) return false;
  if (!silent) {
    const token = state.push("html_inline", "", 0);
    token.content = state.src.slice(pos, end);
    if (isLinkOpen(token.content)) state.linkLevel++;
    if (isLinkClose(token.content)) state.linkLevel--;
  }
  state.pos = end;
  return true;
}
var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
function entity(state, silent) {
  const pos = state.pos;
  const max = state.posMax;
  if (state.src.charCodeAt(pos) !== 38) return false;
  if (pos + 1 >= max) return false;
  if (state.src.charCodeAt(pos + 1) === 35) {
    const match = state.src.slice(pos).match(DIGITAL_RE);
    if (match) {
      if (!silent) {
        const code2 = match[1][0].toLowerCase() === "x" ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
        const token = state.push("text_special", "", 0);
        token.content = isValidEntityCode(code2) ? fromCodePoint(code2) : fromCodePoint(65533);
        token.markup = match[0];
        token.info = "entity";
      }
      state.pos += match[0].length;
      return true;
    }
  } else {
    const match = state.src.slice(pos).match(NAMED_RE);
    if (match) {
      const decoded = decodeHTMLStrict(match[0]);
      if (decoded !== match[0]) {
        if (!silent) {
          const token = state.push("text_special", "", 0);
          token.content = decoded;
          token.markup = match[0];
          token.info = "entity";
        }
        state.pos += match[0].length;
        return true;
      }
    }
  }
  return false;
}
function processDelimiters(delimiters) {
  const openersBottom = {};
  const max = delimiters.length;
  if (!max) return;
  let headerIdx = 0;
  let lastTokenIdx = -2;
  const jumps = [];
  for (let closerIdx = 0; closerIdx < max; closerIdx++) {
    const closer = delimiters[closerIdx];
    jumps.push(0);
    if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) headerIdx = closerIdx;
    lastTokenIdx = closer.token;
    closer.length = closer.length || 0;
    if (!closer.close) continue;
    if (!openersBottom.hasOwnProperty(closer.marker)) openersBottom[closer.marker] = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
    let openerIdx = headerIdx - jumps[headerIdx] - 1;
    let newMinOpenerIdx = openerIdx;
    for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
      const opener = delimiters[openerIdx];
      if (opener.marker !== closer.marker) continue;
      if (opener.open && opener.end < 0) {
        let isOddMatch = false;
        if (opener.close || closer.open) {
          if ((opener.length + closer.length) % 3 === 0) {
            if (opener.length % 3 !== 0 || closer.length % 3 !== 0) isOddMatch = true;
          }
        }
        if (!isOddMatch) {
          const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
          jumps[closerIdx] = closerIdx - openerIdx + lastJump;
          jumps[openerIdx] = lastJump;
          closer.open = false;
          opener.end = closerIdx;
          opener.close = false;
          newMinOpenerIdx = -1;
          lastTokenIdx = -2;
          break;
        }
      }
    }
    if (newMinOpenerIdx !== -1) openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
  }
}
function link_pairs(state) {
  const tokens_meta = state.tokens_meta;
  const max = state.tokens_meta.length;
  processDelimiters(state.delimiters);
  for (let curr = 0; curr < max; curr++) {
    var _tokens_meta$curr;
    const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
    if (delimiters) processDelimiters(delimiters);
  }
}
function fragments_join(state) {
  let curr, last;
  let level = 0;
  const tokens = state.tokens;
  const max = state.tokens.length;
  for (curr = last = 0; curr < max; curr++) {
    if (tokens[curr].nesting < 0) level--;
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) level++;
    if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
    else {
      if (curr !== last) tokens[last] = tokens[curr];
      last++;
    }
  }
  if (curr !== last) tokens.length = last;
}
var _rules = [
  ["text", text],
  ["linkify", linkify],
  ["newline", newline],
  ["escape", escape2],
  ["backticks", backtick],
  ["strikethrough", strikethrough_default.tokenize],
  ["emphasis", emphasis_default.tokenize],
  ["link", link],
  ["image", image],
  ["autolink", autolink],
  ["html_inline", html_inline],
  ["entity", entity]
];
var _rules2 = [
  ["balance_pairs", link_pairs],
  ["strikethrough", strikethrough_default.postProcess],
  ["emphasis", emphasis_default.postProcess],
  ["fragments_join", fragments_join]
];
var ParserInline = class {
  constructor() {
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Keep configuration of inline rules.
      */
      "ruler",
      new Ruler()
    );
    _defineProperty(
      this,
      /**
      * {@link Ruler} instance. Second ruler used for post-processing
      * (e.g. in emphasis-like rules).
      */
      "ruler2",
      new Ruler()
    );
    _defineProperty(this, "State", StateInline);
    for (let i = 0; i < _rules.length; i++) this.ruler.push(_rules[i][0], _rules[i][1]);
    for (let i = 0; i < _rules2.length; i++) this.ruler2.push(_rules2[i][0], _rules2[i][1]);
  }
  skipToken(state) {
    const pos = state.pos;
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const maxNesting = state.md.options.maxNesting;
    const cache = state.cache;
    if (typeof cache[pos] !== "undefined") {
      state.pos = cache[pos];
      return;
    }
    let ok = false;
    if (state.level < maxNesting) for (let i = 0; i < len; i++) {
      state.level++;
      ok = rules[i](state, true);
      state.level--;
      if (ok) {
        if (pos >= state.pos) throw new Error("inline rule didn't increment state.pos");
        break;
      }
    }
    else state.pos = state.posMax;
    if (!ok) state.pos++;
    cache[pos] = state.pos;
  }
  tokenize(state) {
    const rules = this.ruler.getRules("");
    const len = rules.length;
    const end = state.posMax;
    const maxNesting = state.md.options.maxNesting;
    while (state.pos < end) {
      const prevPos = state.pos;
      let ok = false;
      if (state.level < maxNesting) for (let i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) {
          if (prevPos >= state.pos) throw new Error("inline rule didn't increment state.pos");
          break;
        }
      }
      if (ok) {
        if (state.pos >= end) break;
        continue;
      }
      state.pending += state.src[state.pos++];
    }
    if (state.pending) state.pushPending();
  }
  /**
  * Process input string and push inline tokens into `outTokens`
  */
  parse(str, md, env, outTokens) {
    const state = new this.State(str, md, env, outTokens);
    this.tokenize(state);
    const rules = this.ruler2.getRules("");
    const len = rules.length;
    for (let i = 0; i < len; i++) rules[i](state);
  }
};
var config = {
  default: {
    options: {
      html: false,
      xhtmlOut: false,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 100
    },
    components: {
      core: {},
      block: {},
      inline: {}
    }
  },
  zero: {
    options: {
      html: false,
      xhtmlOut: false,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 20
    },
    components: {
      core: { rules: [
        "normalize",
        "block",
        "strip_references",
        "inline",
        "text_join"
      ] },
      block: { rules: ["paragraph"] },
      inline: {
        rules: ["text"],
        rules2: ["balance_pairs", "fragments_join"]
      }
    }
  },
  commonmark: {
    options: {
      html: true,
      xhtmlOut: true,
      breaks: false,
      langPrefix: "language-",
      linkify: false,
      typographer: false,
      quotes: "\u201C\u201D\u2018\u2019",
      highlight: null,
      maxNesting: 20
    },
    components: {
      core: { rules: [
        "normalize",
        "block",
        "strip_references",
        "inline",
        "text_join"
      ] },
      block: { rules: [
        "blockquote",
        "code",
        "fence",
        "heading",
        "hr",
        "html_block",
        "lheading",
        "list",
        "reference",
        "paragraph"
      ] },
      inline: {
        rules: [
          "autolink",
          "backticks",
          "emphasis",
          "entity",
          "escape",
          "html_inline",
          "image",
          "link",
          "newline",
          "text"
        ],
        rules2: [
          "balance_pairs",
          "emphasis",
          "fragments_join"
        ]
      }
    }
  }
};
var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
var RECODE_HOSTNAME_FOR = [
  "http:",
  "https:",
  "mailto:"
];
var MarkdownIt = class {
  /**
  * Link validation function. CommonMark allows too much in links. By default
  * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
  * except some embedded image types.
  *
  * You can change this behaviour:
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * const md = new MarkdownIt()
  *
  * // enable everything
  * md.validateLink = function () { return true; }
  * ```
  */
  validateLink(url) {
    const str = url.trim().toLowerCase();
    return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
  }
  /**
  * Function used to encode link url to a machine-readable format,
  * which includes url-encoding, punycode, etc.
  */
  normalizeLink(url) {
    const parsed = parse_default(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
        parsed.hostname = punycode_es6_default.toASCII(parsed.hostname);
      } catch (er) {
      }
    }
    if (parsed.auth) parsed.auth = encode_default(parsed.auth);
    if (parsed.hostname) parsed.hostname = encode_default(parsed.hostname);
    if (parsed.pathname) parsed.pathname = encode_default(parsed.pathname);
    if (parsed.search) parsed.search = encode_default(parsed.search);
    if (parsed.hash) parsed.hash = encode_default(parsed.hash);
    return format(parsed);
  }
  /**
  * Function used to decode link url to a human-readable format`
  */
  normalizeLinkText(url) {
    const parsed = parse_default(url, true);
    if (parsed.hostname) {
      if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
        parsed.hostname = punycode_es6_default.toUnicode(parsed.hostname);
      } catch (er) {
      }
    }
    return decode_default(format(parsed), decode_default.defaultChars + "%");
  }
  constructor(...args) {
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserInline}. You may need it to add new rules when
      * writing plugins. For simple rules control use {@link MarkdownIt.disable}
      * and {@link MarkdownIt.enable}.
      */
      "inline",
      new ParserInline()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserBlock}. You may need it to add new rules when
      * writing plugins. For simple rules control use {@link MarkdownIt.disable}
      * and {@link MarkdownIt.enable}.
      */
      "block",
      new ParserBlock()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link ParserCore} chain executor. You may need it to add new
      * rules when writing plugins. For simple rules control use
      * {@link MarkdownIt.disable} and {@link MarkdownIt.enable}.
      */
      "core",
      new ParserCore()
    );
    _defineProperty(
      this,
      /**
      * Instance of {@link Renderer}. Use it to modify output look. Or to add rendering
      * rules for new token types, generated by plugins.
      *
      * See {@link Renderer} docs and
      * [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts).
      *
      * @example
      * ```javascript
      * import MarkdownIt from 'markdown-it'
      * const md = new MarkdownIt()
      *
      * function myToken(tokens, idx, options, env, self) {
      *   //...
      *   return result;
      * };
      *
      * md.renderer.rules['my_token'] = myToken
      * ```
      */
      "renderer",
      new Renderer()
    );
    _defineProperty(
      this,
      /**
      * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
      * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/src/rules_core/linkify.ts)
      * rule.
      */
      "linkify",
      new LinkifyIt()
    );
    _defineProperty(
      this,
      /**
      * Assorted utility functions, useful to write plugins. See details
      * [here](https://github.com/markdown-it/markdown-it/blob/master/src/common/utils.ts).
      */
      "utils",
      utils_exports
    );
    _defineProperty(
      this,
      /**
      * Link components parser functions, useful to write plugins. See details
      * [here](https://github.com/markdown-it/markdown-it/blob/master/src/helpers).
      */
      "helpers",
      Object.assign({}, helpers_exports)
    );
    const [presetNameOrOptions, options] = args;
    if (typeof presetNameOrOptions === "string") {
      this.configure(presetNameOrOptions);
      if (options) this.set(options);
    } else {
      this.configure("default");
      this.set(presetNameOrOptions || {});
    }
  }
  /**
  * Set parser options (in the same format as in constructor). Probably, you
  * will never need it, but you can change options after constructor call.
  *
  * __Note:__ To achieve the best possible performance, don't modify a
  * `markdown-it` instance options on the fly. If you need multiple configurations
  * it's best to create multiple instances and initialize each with separate
  * config.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  *
  * const md = new MarkdownIt()
  *   .set({ html: true, breaks: true })
  *   .set({ typographer: true })
  * ```
  */
  set(options) {
    Object.assign(this.options, options);
    return this;
  }
  /**
  * Batch load of all options and compenent settings. This is internal method,
  * and you probably will not need it. But if you will - see available presets
  * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/src/presets)
  *
  * We strongly recommend to use presets instead of direct config loads. That
  * will give better compatibility with next versions.
  */
  configure(presets) {
    let p;
    if (typeof presets === "string") {
      const presetName = presets;
      p = config[presetName];
      if (!p) throw new Error(`Wrong 'markdown-it' preset "${presetName}", check name`);
    } else p = presets;
    if (!p) throw new Error("Wrong `markdown-it` preset, can't be empty");
    if (p.options) this.options = { ...p.options };
    const components = p.components;
    if (components) {
      var _components$inline;
      [
        "core",
        "block",
        "inline"
      ].forEach((name) => {
        var _components$name;
        const rules = (_components$name = components[name]) === null || _components$name === void 0 ? void 0 : _components$name.rules;
        if (rules) this[name].ruler.enableOnly(rules);
      });
      const rules2 = (_components$inline = components.inline) === null || _components$inline === void 0 ? void 0 : _components$inline.rules2;
      if (rules2) this.inline.ruler2.enableOnly(rules2);
    }
    return this;
  }
  /**
  * Enable list or rules. It will automatically find appropriate components,
  * containing rules with given names. If rule not found, and `ignoreInvalid`
  * not set - throws exception.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  *
  * const md = new MarkdownIt()
  *   .enable(['sub', 'sup'])
  *   .disable('smartquotes')
  * ```
  */
  enable(list2, ignoreInvalid = false) {
    let result = [];
    if (!Array.isArray(list2)) list2 = [list2];
    [
      "core",
      "block",
      "inline"
    ].forEach((chain) => {
      result = result.concat(this[chain].ruler.enable(list2, true));
    });
    result = result.concat(this.inline.ruler2.enable(list2, true));
    const missed = list2.filter((name) => result.indexOf(name) < 0);
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to enable unknown rule(s): ${missed}`);
    return this;
  }
  /**
  * The same as {@link MarkdownIt.enable}, but turn specified rules off.
  */
  disable(list2, ignoreInvalid = false) {
    let result = [];
    if (!Array.isArray(list2)) list2 = [list2];
    [
      "core",
      "block",
      "inline"
    ].forEach((chain) => {
      result = result.concat(this[chain].ruler.disable(list2, true));
    });
    result = result.concat(this.inline.ruler2.disable(list2, true));
    const missed = list2.filter((name) => result.indexOf(name) < 0);
    if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to disable unknown rule(s): ${missed}`);
    return this;
  }
  /**
  * Load specified plugin with given params into current parser instance.
  * It's just a sugar to call `plugin(md, params)` with curring.
  *
  * @example
  * ```javascript
  * import MarkdownIt from 'markdown-it'
  * import iterator from 'markdown-it-for-inline'
  *
  * const md = new MarkdownIt()
  *   .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
  *     tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar')
  *   })
  * ```
  */
  use(plugin, ...params) {
    plugin.apply(plugin, [this, ...params]);
    return this;
  }
  /**
  * Parse input string and return list of block tokens (special token type
  * "inline" will contain list of inline tokens). You should not call this
  * method directly, until you write custom renderer (for example, to produce
  * AST).
  *
  * `env` is used to pass data between "distributed" rules and return additional
  * metadata like reference info, needed for the renderer. It also can be used to
  * inject data in specific cases. Usually, you will be ok to pass `{}`,
  * and then pass updated object to renderer.
  */
  parse(src, env) {
    if (typeof src !== "string") throw new Error("Input data should be a String");
    const state = new this.core.State(src, this, env);
    this.core.process(state);
    return state.tokens;
  }
  /**
  * Render markdown string into html. It does all magic for you :).
  *
  * `env` can be used to inject additional metadata (`{}` by default).
  * But you will not need it with high probability. See also comment
  * in {@link MarkdownIt.parse}.
  */
  render(src, env = {}) {
    return this.renderer.render(this.parse(src, env), this.options, env);
  }
  /**
  * The same as {@link MarkdownIt.parse} but skip all block rules. It returns
  * the block tokens list with the single `inline` element, containing parsed
  * inline tokens in `children` property. Also updates `env` object.
  */
  parseInline(src, env) {
    const state = new this.core.State(src, this, env);
    state.inlineMode = true;
    this.core.process(state);
    return state.tokens;
  }
  /**
  * Similar to {@link MarkdownIt.render} but for single paragraph content.
  * Result will NOT be wrapped into `<p>` tags.
  */
  renderInline(src, env = {}) {
    return this.renderer.render(this.parseInline(src, env), this.options, env);
  }
};
_defineProperty(MarkdownIt, "Token", Token);
_defineProperty(MarkdownIt, "Ruler", Ruler);
_defineProperty(MarkdownIt, "Renderer", Renderer);
_defineProperty(MarkdownIt, "ParserCore", ParserCore);
_defineProperty(MarkdownIt, "StateCore", StateCore);
_defineProperty(MarkdownIt, "ParserBlock", ParserBlock);
_defineProperty(MarkdownIt, "StateBlock", StateBlock);
_defineProperty(MarkdownIt, "ParserInline", ParserInline);
_defineProperty(MarkdownIt, "StateInline", StateInline);
var MarkdownItCallable = callable(MarkdownIt);

// src/shared/escape.logic.ts
function escapeHtml2(text2) {
  return text2.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

// src/shared/syntax-warning.part.ts
var WARNING_TITLE = "\u8A18\u8F09\u306E\u8B66\u544A";
function renderInline(text2) {
  return text2.split("`").map(
    (part, index) => index % 2 === 1 ? `<code>${escapeHtml2(part)}</code>` : escapeHtml2(part)
  ).join("");
}
function renderSyntaxWarning(options) {
  const { mark = "", message, items = [], id } = options;
  const markHtml = mark ? `<code>${escapeHtml2(mark)}</code>` : "";
  const list2 = items.length ? `<ul>${items.map(
    (item) => `<li>${item.label ? `<code>${escapeHtml2(item.label)}</code>: ` : ""}${renderInline(item.message)}</li>`
  ).join("")}</ul>` : "";
  const idAttribute = id === void 0 ? "" : ` id="${escapeHtml2(id)}"`;
  return `<div class="mdmark-syntax-warning" role="note"${idAttribute}><p class="mdmark-syntax-warning-title">${WARNING_TITLE}</p><p>${markHtml}${renderInline(message)}</p>${list2}</div>`;
}

// src/diagram/definition.ts
var RETIRED_DIAGRAM_DIRECTIVES = [
  "flow",
  "sequence",
  "er"
];
var DIAGRAM_DIRECTIVES = {
  chart: { name: "\u30B0\u30E9\u30D5", call: "\u3053\u306E\u30B0\u30E9\u30D5" },
  param: { name: "\u64CD\u4F5C\u3067\u304D\u308B\u90E8\u54C1", call: "\u3053\u306E\u90E8\u54C1" }
};
function missingSymbols(text2) {
  const stack = [];
  let inString = false;
  for (let index = 0; index < text2.length; index++) {
    const char = text2[index];
    if (inString) {
      if (char === "\\") {
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    inString = char === '"';
    trackBracket(stack, char);
  }
  return `${inString ? '"' : ""}${stack.reverse().join("")}`;
}
function trackBracket(stack, char) {
  if (char === "{") {
    stack.push("}");
  } else if (char === "[") {
    stack.push("]");
  } else if (char === "}" || char === "]") {
    stack.pop();
  }
}
function errorPosition(error2, length) {
  const message = error2 instanceof Error ? error2.message : "";
  const position = /position (\d+)/.exec(message)?.[1];
  return position === void 0 ? length : Math.min(Number(position), length);
}
function parseDefinitionJson(text2) {
  try {
    return { ok: true, value: JSON.parse(text2) };
  } catch (error2) {
    const position = errorPosition(error2, text2.length);
    const readable = text2.slice(0, position).trimEnd();
    const lines = readable.split("\n");
    const atEnd = text2.slice(position).trim() === "";
    return {
      ok: false,
      line: lines.length,
      after: (lines.at(-1) ?? "").trim(),
      missing: atEnd ? missingSymbols(readable) : ""
    };
  }
}

// src/map/packet.ts
var PACKET_FILLS = [
  "solid",
  "ring",
  "tinted",
  "glow",
  "shine",
  "random"
];
var PACKET_PALETTES = [
  "accent",
  "vivid",
  "pastel",
  "muted",
  "cool"
];
var DEFAULT_PACKET_STYLE = {
  fill: "tinted",
  palette: "accent"
};

// src/table/table.logic.ts
var FILTER_KINDS = ["select", "text", "date"];
var collator = new Intl.Collator("ja", { numeric: true });
var TOTAL_CALCS = ["sum", "avg", "count"];
var totalFormat = new Intl.NumberFormat("ja", { maximumFractionDigits: 2 });
var DEFAULT_LONG_COLUMN_MIN_EM = 45;

// src/config.ts
var COLOR_THEMES = [
  "dev-swiss",
  "theme-paper",
  "theme-slate",
  "theme-contrast"
];
var DEFAULT_COLOR_THEME = "dev-swiss";
var COLOR_SCHEMES = ["light", "dark", "auto"];
var DEFAULT_COLOR_SCHEME = "auto";
var DEFAULT_LABELS = {
  paramCopy: "\u4ECA\u306E\u5024\u3092\u30B3\u30D4\u30FC\u3059\u308B"
};
var DEFAULT_FEATURES = {
  print: true,
  table: true,
  callout: true,
  tabs: true,
  steps: true,
  tree: true,
  badge: true,
  footnotes: true,
  annotations: true,
  code: true,
  syntax: true,
  toc: true,
  anchors: true,
  sections: true,
  "row-details": true,
  figures: true,
  diagrams: true,
  "diagram-resize": true,
  glossary: true,
  backlinks: true,
  html: true,
  hints: true,
  mermaid: true,
  views: true,
  comments: false,
  "html-scripts": false,
  "side-toc": true,
  "back-to-top": true,
  "markdown-buttons": true,
  "text-color": true,
  images: true,
  gallery: true,
  lightbox: true,
  media: true,
  gif: true,
  cards: true,
  icon: true,
  columns: true,
  highlight: true,
  kbd: true,
  details: true,
  pagebreak: true,
  include: true,
  wide: true,
  csv: true,
  "card-grid": true,
  frontmatter: false,
  map: true
};
var DEFAULT_SYNTAX_URL = "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";
var DEFAULT_HTML_SCRIPTS_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@8.1.1/+esm";
var DEFAULT_MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";
var MERMAID_THEMES = [
  "mdmark",
  "default",
  "neutral",
  "dark",
  "forest",
  "base"
];
var FIXED_MERMAID_VARIABLES = /* @__PURE__ */ new Set(["useGradient", "dropShadow"]);
var pickThemeVariables = (given) => {
  const themeVariables = {};
  if (given === null || typeof given !== "object" || Array.isArray(given)) {
    return themeVariables;
  }
  for (const [key, value] of Object.entries(given)) {
    if (typeof value === "string" && !FIXED_MERMAID_VARIABLES.has(key)) {
      themeVariables[key] = value;
    }
  }
  return themeVariables;
};
var resolveMermaid = (mermaid) => ({
  url: urlOr(mermaid?.url, DEFAULT_MERMAID_URL),
  theme: MERMAID_THEMES.find((name) => name === mermaid?.theme) ?? "mdmark",
  themeVariables: pickThemeVariables(mermaid?.themeVariables)
});
var DEFAULT_LIBRARIES = {};
var MARK_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
function resolveFeatures(given) {
  const features = { ...DEFAULT_FEATURES };
  for (const name of Object.keys(DEFAULT_FEATURES)) {
    const value = given?.[name];
    if (typeof value === "boolean") {
      features[name] = value;
    }
  }
  return features;
}
function resolveLibraries(given, defaultLibraries) {
  const libraries = {};
  for (const [name, entry] of Object.entries(defaultLibraries)) {
    libraries[name] = { ...entry };
  }
  for (const [name, url] of Object.entries(given ?? {})) {
    if (!MARK_NAME_PATTERN.test(name) || typeof url !== "string") {
      continue;
    }
    const existing = Object.hasOwn(libraries, name) ? libraries[name] : void 0;
    libraries[name] = existing ? { ...existing, url } : { url, figure: true };
  }
  return libraries;
}
function resolveTooltips(tooltips) {
  return {
    placement: tooltips?.placement === "bottom" ? "bottom" : "top",
    diagramPlacement: tooltips?.diagramPlacement === "top" ? "top" : "bottom"
  };
}
function urlOr(url, fallback) {
  return typeof url === "string" ? url : fallback;
}
function resolveTable(table2) {
  const requestedMin = table2?.long_column_min;
  const valid = typeof requestedMin === "number" && Number.isFinite(requestedMin) && requestedMin > 0;
  return {
    pin: table2?.pin === "through" ? "through" : "each",
    pinDefault: table2?.pin_default === true,
    longColumnMin: valid ? requestedMin : DEFAULT_LONG_COLUMN_MIN_EM
  };
}
function resolveLabels(labels) {
  const paramCopy = labels?.paramCopy;
  return {
    paramCopy: typeof paramCopy === "string" && paramCopy !== "" ? paramCopy : DEFAULT_LABELS.paramCopy
  };
}
function resolveConfig(options) {
  const { config: config2 = {}, defaultLibraries = DEFAULT_LIBRARIES } = options;
  return {
    features: resolveFeatures(config2.features),
    libraries: resolveLibraries(config2.libraries, defaultLibraries),
    tooltips: resolveTooltips(config2.tooltips),
    syntax: { url: urlOr(config2.syntax?.url, DEFAULT_SYNTAX_URL) },
    htmlScripts: {
      url: urlOr(config2["html-scripts"]?.url, DEFAULT_HTML_SCRIPTS_URL)
    },
    mermaid: resolveMermaid(config2.mermaid),
    // 右側の目次の出し方は、fixed だけを受け、他の値は hover にする
    sideToc: { mode: config2["side-toc"]?.mode === "fixed" ? "fixed" : "hover" },
    table: resolveTable(config2.table),
    // テーマ・明暗は、COLOR_THEMES・COLOR_SCHEMES にある値だけを受け、他の値は既定にする
    colorTheme: oneOf(COLOR_THEMES, config2.colorTheme) ?? DEFAULT_COLOR_THEME,
    colorScheme: oneOf(COLOR_SCHEMES, config2.colorScheme) ?? DEFAULT_COLOR_SCHEME,
    labels: resolveLabels(config2.labels),
    map: resolveMapConfig(config2.map)
  };
}
var MAP_SHAPES = ["rounded", "rect", "pill", "double"];
var MAP_DASHES = [
  "solid",
  "dashed",
  "dotted",
  "dash-dot",
  "long-dash"
];
var MAP_WIDTHS = ["thin", "normal", "thick"];
var MAP_HEADS = ["filled", "open", "none"];
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var oneOf = (list2, value) => typeof value === "string" && list2.includes(value) ? value : void 0;
var recordEntries = (value) => Object.entries(isRecord2(value) ? value : {});
var resolveMapKind = (kind) => {
  const entry = {};
  if (typeof kind.label === "string") entry.label = kind.label;
  if (typeof kind.icon === "string") entry.icon = kind.icon;
  const shape = oneOf(MAP_SHAPES, kind.shape);
  if (shape) entry.shape = shape;
  if (typeof kind.color === "string") entry.color = kind.color;
  return entry;
};
var resolveMapLine = (line) => {
  const entry = {};
  const dash = oneOf(MAP_DASHES, line.dash);
  if (dash) entry.dash = dash;
  const width = oneOf(MAP_WIDTHS, line.width);
  if (width) entry.width = width;
  const head = oneOf(MAP_HEADS, line.head);
  if (head) entry.head = head;
  if (typeof line.color === "string") entry.color = line.color;
  return entry;
};
var resolveMapConfig = (value) => {
  const map3 = isRecord2(value) ? value : {};
  const kinds = {};
  for (const [name, kind] of recordEntries(map3.kinds)) {
    if (isRecord2(kind)) kinds[name] = resolveMapKind(kind);
  }
  const lines = {};
  for (const [name, line] of recordEntries(map3.lines)) {
    if (isRecord2(line)) lines[name] = resolveMapLine(line);
  }
  return {
    node_fit: map3.node_fit === "width" ? "width" : "height",
    url_state: typeof map3.url_state === "boolean" ? map3.url_state : true,
    kinds,
    lines,
    packets: resolvePacketStyle(map3.packets)
  };
};
var resolvePacketStyle = (value) => {
  const packets = isRecord2(value) ? value : {};
  const fill = PACKET_FILLS.find((item) => item === packets.fill);
  const palette = PACKET_PALETTES.find((item) => item === packets.palette);
  return {
    fill: fill ?? DEFAULT_PACKET_STYLE.fill,
    palette: palette ?? DEFAULT_PACKET_STYLE.palette
  };
};

// src/extensions.ts
var extensions = /* @__PURE__ */ new Map();
function extensionFor(directive) {
  return extensions.get(directive);
}

// src/features.ts
function resolveFeatures2(options) {
  const features = { ...options.defaults };
  for (const mark of options.marks) {
    for (const [name, value] of Object.entries(mark)) {
      if (typeof value === "boolean" && Object.hasOwn(features, name)) {
        features[name] = value;
      }
    }
  }
  return features;
}

// src/shared/embed.part.ts
var LOADING_TEXT = "\u56F3\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059";
function renderEmbed(options) {
  const { name, options: markOptions = {}, definition } = options;
  const index = definition === void 0 ? "" : ` data-mdmark-definition="${definition}"`;
  return `<div class="mdmark-embed" data-mdmark-slot="${escapeHtml2(name)}" data-mdmark-args="${escapeHtml2(JSON.stringify(markOptions))}"${index} role="status">${LOADING_TEXT}</div>`;
}

// src/shared/own.logic.ts
function markOwn(html, nonce) {
  return html.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)/g,
    `<$1 data-mdmark-own="${nonce}"`
  );
}

// src/shared/collapse.logic.ts
function titleTailOf(text2) {
  const tail = /(?:^|\s)title=\S*\s+(\S+)/.exec(text2)?.[1];
  return tail === void 0 || tail.includes("=") ? void 0 : tail;
}

// src/shared/colors.logic.ts
var COLOR_NAMES = [
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "purple",
  "gray"
];
function isColorName(value) {
  return COLOR_NAMES.includes(value);
}

// src/footnote/footnote.syntax.ts
var DEF_OPEN = "mdmark_footnote_def_open";
var DEF_CLOSE = "mdmark_footnote_def_close";
var ANNOTATION_DEF_OPEN = "mdmark_annotation_def_open";
var ANNOTATION_DEF_CLOSE = "mdmark_annotation_def_close";
var DEFINITION_CLOSES = {
  [DEF_OPEN]: DEF_CLOSE,
  [ANNOTATION_DEF_OPEN]: ANNOTATION_DEF_CLOSE
};

// src/table/table.syntax.ts
var TABLE_KINDS = {
  default: ["sort", "pin", "resize"],
  data: ["sort", "pin", "filter", "resize"],
  plain: []
};
var TABLE_FEATURES = [
  "sort",
  "pin",
  "filter",
  "resize",
  "count",
  "columns",
  "reorder",
  "total",
  "copy",
  "rowlink"
];

// src/render/legacy-marks.ts
var PAGE_VALUES = {
  scheme: COLOR_SCHEMES,
  theme: COLOR_THEMES,
  toc: ["hover", "fixed"]
};
var rangesOf = (key, value, dropped) => {
  const out = [];
  for (const part of value.split(",")) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      out.push({ from: Number(range[1]), to: Number(range[2]) });
    } else if (/^\d+$/.test(part)) {
      out.push(Number(part));
    } else {
      dropped.push({
        text: `${key}=${part}`,
        reason: `\u8AAD\u307F\u8FBC\u3081\u306A\u3044\u884C\u306E\u6307\u5B9A\u3067\u3059\u30022\u30FB4-6 \u306E\u3088\u3046\u306B\u3001\u884C\u306E\u756A\u53F7\u3068\u7BC4\u56F2\u3092\u30B3\u30F3\u30DE\u3067\u4E26\u3079\u3066\u304F\u3060\u3055\u3044`
      });
    }
  }
  return out;
};
var collapseOf = (flags, title) => {
  if (flags.length === 0) {
    return void 0;
  }
  const collapse = { open: !flags.includes("closed") };
  if (title) {
    collapse.title = title;
  }
  return collapse;
};
var TITLE_SPACE_REASON = "\u4ECA\u306E\u66F8\u304D\u65B9\u306E\u30DE\u30FC\u30AB\u30FC\u306E\u5F15\u6570\u306F\u7A7A\u767D\u3067\u533A\u5207\u308B\u305F\u3081\u3001title= \u306E\u5024\u306B\u7A7A\u767D\u306F\u8A18\u8F09\u3067\u304D\u307E\u305B\u3093";
var unknownWord = (text2) => ({
  text: text2,
  reason: "\u3053\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u306E mdmark \u304C\u77E5\u3089\u306A\u3044\u6307\u5B9A\u3067\u3059"
});
var droppedArg = (arg, tail) => arg === tail ? { text: arg, reason: TITLE_SPACE_REASON } : unknownWord(arg);
var collapseInto = (converted, context) => {
  const { flags, title, scope } = context;
  const collapse = collapseOf(flags, title);
  if (collapse) {
    converted.options.collapse = collapse;
  } else if (title !== void 0) {
    converted.dropped.push({
      text: `title=${title}`,
      reason: `closed \u304B open \u3068\u4E00\u7DD2\u306B\u8A18\u8F09\u3057\u305F${scope}\u3067\u3060\u3051\u4F7F\u7528\u3067\u304D\u308B\u305F\u3081\u3001\u4ECA\u306E\u5B9F\u88C5\u306F\u9069\u7528\u3057\u3066\u3044\u307E\u305B\u3093`
    });
  }
};
var isFeatureToggle = (arg) => /^[+-]/.test(arg) && TABLE_FEATURES.includes(arg.slice(1));
var readTableArgs = (args, context) => {
  let kind = "default";
  const flags = [];
  const features = {};
  args.forEach((arg, index) => {
    if (index === 0 && (arg === "data" || arg === "plain")) {
      kind = arg;
    } else if (arg === "closed" || arg === "open") {
      flags.push(arg);
    } else if (isFeatureToggle(arg)) {
      features[arg.slice(1)] = arg.startsWith("+") ? {} : { enabled: false };
    } else {
      context.dropped.push(droppedArg(arg, context.tail));
    }
  });
  return { kind, flags, features };
};
var enabledOf = (kind, features) => {
  const enabled = new Set(
    TABLE_KINDS[kind]
  );
  for (const [name, value] of Object.entries(features)) {
    if (value.enabled === false) {
      enabled.delete(name);
    } else {
      enabled.add(name);
    }
  }
  return enabled;
};
var tableColumn = (conv, name) => {
  conv.columns[name] ??= {};
  return conv.columns[name];
};
var needsFeature = (conv, entry) => {
  const { key, value, feature } = entry;
  if (conv.enabled.has(feature)) {
    return true;
  }
  conv.dropped.push({
    text: `${key}=${value}`,
    reason: `+${feature} \u3092\u8A18\u8F09\u3057\u305F\u8868\u3067\u3060\u3051\u4F7F\u7528\u3067\u304D\u308B\u305F\u3081\u3001\u4ECA\u306E\u5B9F\u88C5\u306F\u9069\u7528\u3057\u3066\u3044\u307E\u305B\u3093`
  });
  return false;
};
var setColumns = (conv, entry) => {
  for (const name of entry.value.split(",")) {
    tableColumn(conv, name)[entry.key] = entry.setting;
  }
};
var readFilterKey = (conv, entry) => {
  if (!needsFeature(conv, { ...entry, feature: "filter" })) return;
  for (const item of entry.value.split(",")) {
    const [name = "", type] = item.split(":");
    if (type !== void 0 && !FILTER_KINDS.includes(type)) {
      conv.dropped.push({
        text: `filter=${item}`,
        reason: `\u7D5E\u308A\u8FBC\u307F\u306E\u7A2E\u985E ${type} \u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u4F7F\u7528\u3067\u304D\u308B\u7A2E\u985E\u306F select\u30FBtext\u30FBdate \u3067\u3059`
      });
      continue;
    }
    tableColumn(conv, name).filter = type === void 0 ? {} : { type };
  }
};
var readTotalKey = (conv, entry) => {
  if (!needsFeature(conv, { ...entry, feature: "total" })) return;
  for (const item of entry.value.split(",")) {
    const [name = "", calc = ""] = item.split(":");
    if (!TOTAL_CALCS.includes(calc)) {
      conv.dropped.push({
        text: `total=${item}`,
        reason: `\u8A08\u7B97 ${calc} \u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002\u4F7F\u7528\u3067\u304D\u308B\u8A08\u7B97\u306F sum\u30FBavg\u30FBcount \u3067\u3059`
      });
      continue;
    }
    const settings = tableColumn(conv, name);
    settings.total = [...settings.total ?? [], { calc }];
  }
};
var isColorName2 = (color) => COLOR_NAMES.includes(color);
var readHighlightKey = (conv, entry) => {
  for (const item of entry.value.split(",")) {
    const [name = "", color] = item.split(":");
    if (color !== void 0 && !isColorName2(color)) {
      conv.dropped.push({
        text: `highlight=${item}`,
        reason: `\u8272\u306E\u540D\u524D ${color} \u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093`
      });
      continue;
    }
    tableColumn(conv, name).highlight = color === void 0 ? {} : { color };
  }
};
var readRowColorKey = (conv, entry) => {
  const [name = "", pairs2 = ""] = entry.value.split(/:(.*)/s);
  for (const pair of pairs2.split(",")) {
    const [cell = "", color = ""] = pair.split("=");
    if (!isColorName2(color)) {
      conv.dropped.push({
        text: `row-color=${name}:${pair}`,
        reason: `\u8272\u306E\u540D\u524D ${color} \u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093`
      });
      continue;
    }
    conv.colors.push({ column: name, value: cell, color });
  }
};
var rowAtOf = (position) => {
  const range = /^(\d+)-(\d+)$/.exec(position);
  if (range) {
    return { from: Number(range[1]), to: Number(range[2]) };
  }
  return /^\d+$/.test(position) ? Number(position) : void 0;
};
var readRowAtKey = (conv, entry) => {
  for (const pair of entry.value.split(",")) {
    const [position = "", color = ""] = pair.split("=");
    const at = rowAtOf(position);
    if (at === void 0 || !isColorName2(color)) {
      conv.dropped.push({
        text: `row-at=${pair}`,
        reason: "\u884C\u306E\u4F4D\u7F6E\u304B\u8272\u306E\u540D\u524D\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093"
      });
      continue;
    }
    conv.atColors.push({ at, color });
  }
};
var readHeaderKey = (conv, entry) => {
  const { key, value } = entry;
  const rows = key === "header-rows";
  const count = Number(value);
  if (!/^\d+$/.test(value) || count < (rows ? 1 : 0)) {
    conv.dropped.push({
      text: `${key}=${value}`,
      reason: "\u6570\u3068\u3057\u3066\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093"
    });
    return;
  }
  conv.header[rows ? "rows" : "columns"] = count;
};
var readTreeKey = (conv, entry) => {
  conv.tree[entry.key === "tree" ? "key" : entry.key] = { column: entry.value };
};
var TABLE_KEY_READERS = {
  filter: readFilterKey,
  hide: (conv, entry) => {
    if (!needsFeature(conv, { ...entry, feature: "columns" })) return;
    setColumns(conv, { value: entry.value, key: "hidden", setting: true });
  },
  total: readTotalKey,
  pin: (conv, entry) => {
    if (!needsFeature(conv, { ...entry, feature: "pin" })) return;
    setColumns(conv, { value: entry.value, key: "pinned", setting: true });
  },
  wide: (conv, entry) => setColumns(conv, {
    value: entry.value,
    key: "width",
    setting: { mode: "nowrap" }
  }),
  check: (conv, entry) => setColumns(conv, {
    value: entry.value,
    key: "format",
    setting: { type: "check" }
  }),
  highlight: readHighlightKey,
  "row-color": readRowColorKey,
  "row-at": readRowAtKey,
  "header-rows": readHeaderKey,
  "row-header": readHeaderKey,
  tree: readTreeKey,
  type: readTreeKey,
  required: readTreeKey,
  default: readTreeKey,
  example: (conv, entry) => {
    conv.tree.example = { heading: entry.value };
  },
  title: () => {
  }
};
var dropOrphanTree = (conv) => {
  if (Object.keys(conv.tree).length === 0 || conv.tree.key !== void 0) {
    return;
  }
  for (const key of Object.keys(conv.tree)) {
    conv.dropped.push({
      text: `${key === "key" ? "tree" : key}=`,
      reason: "tree= \u3068\u4E00\u7DD2\u306B\u8A18\u8F09\u3057\u305F\u8868\u3067\u3060\u3051\u4F7F\u7528\u3067\u304D\u308B\u305F\u3081\u3001\u4ECA\u306E\u5B9F\u88C5\u306F\u9069\u7528\u3057\u3066\u3044\u307E\u305B\u3093"
    });
    delete conv.tree[key];
  }
};
var dropColumnFeatures = (features, columns) => {
  const fromColumns = /* @__PURE__ */ new Set();
  for (const settings of Object.values(columns)) {
    if (settings.filter !== void 0) fromColumns.add("filter");
    if (settings.hidden !== void 0) fromColumns.add("columns");
    if (settings.pinned !== void 0) fromColumns.add("pin");
    if (settings.total !== void 0) fromColumns.add("total");
  }
  for (const name of fromColumns) {
    if (features[name] !== void 0 && features[name].enabled !== false) {
      delete features[name];
    }
  }
};
var assembleTable = (options, context) => {
  const { conv, features } = context;
  if (Object.keys(features).length > 0) options.features = features;
  if (Object.keys(conv.columns).length > 0) options.columns = conv.columns;
  if (Object.keys(conv.header).length > 0) options.header = conv.header;
  if (conv.colors.length + conv.atColors.length > 0)
    options.rows = { colors: [...conv.colors, ...conv.atColors] };
  if (Object.keys(conv.tree).length > 0) options.tree = conv.tree;
};
var convertTable = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  const dropped = [];
  const tail = keys.title === void 0 ? void 0 : titleTailOf(text2);
  const { kind, flags, features } = readTableArgs(args, { tail, dropped });
  const options = kind === "default" ? {} : { kind };
  const conv = {
    dropped,
    enabled: enabledOf(kind, features),
    columns: {},
    header: {},
    colors: [],
    atColors: [],
    tree: {}
  };
  for (const [key, value] of Object.entries(keys)) {
    if (Object.hasOwn(TABLE_KEY_READERS, key)) {
      TABLE_KEY_READERS[key]?.(conv, { key, value });
    } else {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  dropOrphanTree(conv);
  dropColumnFeatures(features, conv.columns);
  assembleTable(options, { conv, features });
  const converted = { options, dropped };
  collapseInto(converted, { flags, title: keys.title, scope: "\u8868" });
  return converted;
};
var convertCollapseRange = (text2, withGroup) => {
  const { args, keys } = parseMarkArgs(text2);
  const dropped = [];
  const options = {};
  const flags = args.filter((arg) => arg === "closed" || arg === "open");
  const tail = keys.title === void 0 ? void 0 : titleTailOf(text2);
  for (const arg of args.filter((arg2) => arg2 !== "closed" && arg2 !== "open")) {
    dropped.push(droppedArg(arg, tail));
  }
  for (const [key, value] of Object.entries(keys)) {
    if (withGroup && key === "group") {
      readGroupKey({ options, dropped }, value);
    } else if (key !== "title") {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  const converted = { options, dropped };
  collapseInto(converted, { flags, title: keys.title, scope: "\u7BC4\u56F2" });
  return converted;
};
var readGroupKey = (converted, value) => {
  if (value === "") {
    converted.dropped.push({ text: "group=", reason: "\u7D44\u306E\u540D\u524D\u304C\u3042\u308A\u307E\u305B\u3093" });
  } else {
    converted.options.group = value;
  }
};
var readCodeArg = (converted, context) => {
  const { arg, tail } = context;
  if (arg === "lines") converted.options.lines = {};
  else if (arg === "wrap") converted.options.wrap = true;
  else converted.dropped.push(droppedArg(arg, tail));
};
var readCodeKey = (converted, entry) => {
  const { key, value } = entry;
  if (key === "highlight" || key === "fold") {
    const ranges = rangesOf(key, value, converted.dropped);
    if (ranges.length > 0) converted.options[key] = ranges;
  } else if (key === "wrap") {
    converted.dropped.push({
      text: `wrap=${value}`,
      reason: "wrap \u306F\u5024\u3092\u6301\u3061\u307E\u305B\u3093"
    });
  } else if (key !== "title") {
    converted.dropped.push(unknownWord(`${key}=`));
  }
};
var convertCode = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  const converted = { options: {}, dropped: [] };
  const tail = keys.title === void 0 ? void 0 : titleTailOf(text2);
  if (keys.title === "") {
    converted.dropped.push({ text: "title=", reason: "\u30BF\u30A4\u30C8\u30EB\u304C\u3042\u308A\u307E\u305B\u3093" });
  } else if (keys.title !== void 0) {
    converted.options.title = keys.title;
  }
  for (const arg of args) readCodeArg(converted, { arg, tail });
  for (const [key, value] of Object.entries(keys))
    readCodeKey(converted, { key, value });
  const ordered = {};
  for (const key of ["title", "lines", "highlight", "fold", "wrap"]) {
    if (converted.options[key] !== void 0)
      ordered[key] = converted.options[key];
  }
  return { options: ordered, dropped: converted.dropped };
};
var readTreeOpenKey = (converted, entry) => {
  const { key, value } = entry;
  if (key === "open" && (value === "all" || /^[1-9]\d*$/.test(value))) {
    converted.options.depth = value === "all" ? "all" : Number(value);
  } else if (key === "open") {
    converted.dropped.push({
      text: `open=${value}`,
      reason: "\u8A18\u8F09\u3067\u304D\u308B\u5024\u306F all \u3068\u968E\u5C64\u306E\u6570\u3067\u3059"
    });
  } else if (key === "wrap") {
    converted.dropped.push({
      text: `wrap=${value}`,
      reason: "wrap \u306F\u5024\u3092\u6301\u3061\u307E\u305B\u3093"
    });
  } else {
    converted.dropped.push(unknownWord(`${key}=`));
  }
};
var convertTree = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  const converted = { options: {}, dropped: [] };
  for (const [key, value] of Object.entries(keys))
    readTreeOpenKey(converted, { key, value });
  for (const arg of args) {
    if (arg === "wrap") converted.options.wrap = true;
    else converted.dropped.push(unknownWord(arg));
  }
  return converted;
};
var readViewFilterKey = (conv, value) => {
  for (const item of value.split(",")) {
    const [name = "", type] = item.split(":");
    if (type !== void 0 && !FILTER_KINDS.includes(type)) {
      conv.dropped.push({
        text: `filter=${item}`,
        reason: `\u7D5E\u308A\u8FBC\u307F\u306E\u7A2E\u985E ${type} \u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093`
      });
      continue;
    }
    conv.columns[name] = { filter: type === void 0 ? {} : { type } };
  }
};
var VIEW_KEY_READERS = {
  group: (conv, value) => {
    conv.board.group = { column: value };
  },
  default: (conv, value) => {
    if (value === "board" || value === "table") conv.options.initial = value;
    else
      conv.dropped.push({
        text: `default=${value}`,
        reason: "\u8A18\u8F09\u3067\u304D\u308B\u5024\u306F board \u3068 table \u3067\u3059"
      });
  },
  filter: readViewFilterKey,
  icons: (conv, value) => {
    const values = {};
    for (const item of value.split(",")) {
      const [cell = "", icon = ""] = item.split(":");
      values[cell] = { icon };
    }
    conv.board.values = values;
  }
};
var convertView = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  const conv = {
    options: {},
    dropped: args.map(unknownWord),
    board: {},
    columns: {}
  };
  for (const [key, value] of Object.entries(keys)) {
    if (Object.hasOwn(VIEW_KEY_READERS, key)) {
      VIEW_KEY_READERS[key]?.(conv, value);
    } else {
      conv.dropped.push(unknownWord(`${key}=`));
    }
  }
  const { board, columns, options } = conv;
  const ordered = {};
  if (Object.keys(board).length > 0) {
    ordered.board = {
      ...board.group === void 0 ? {} : { group: board.group },
      ...board.values === void 0 ? {} : { values: board.values }
    };
  }
  if (options.initial !== void 0) ordered.initial = options.initial;
  if (Object.keys(columns).length > 0) ordered.columns = columns;
  return { options: ordered, dropped: conv.dropped };
};
var convertInclude = (text2) => {
  const [target = "", ...extra] = text2.split(/\s+/).filter(Boolean);
  const dropped = extra.map(unknownWord);
  const [path = "", anchor] = target.split("#");
  const options = { path };
  if (anchor !== void 0 && anchor !== "") {
    const lines = /^L(\d+)-L(\d+)$/.exec(anchor);
    if (lines && !/\.md$/i.test(path)) {
      options.lines = { from: Number(lines[1]), to: Number(lines[2]) };
    } else {
      options.heading = anchor;
    }
  }
  return { options, dropped };
};
var convertLegacyArgs = (options) => {
  const converted = convertByName(options);
  const at = (item) => {
    const index = options.text.indexOf(item.text.replace(/=$/, "="));
    return index < 0 ? options.text.length : index;
  };
  return {
    options: converted.options,
    dropped: [...converted.dropped].sort((x, y) => at(x) - at(y))
  };
};
var convertSection = (text2) => {
  const [first] = parseMarkArgs(text2).args;
  if (first === "closed" || first === "open") {
    return { options: { open: first === "open" }, dropped: [] };
  }
  return {
    options: {},
    dropped: first === void 0 ? [] : [unknownWord(first)]
  };
};
var convertWide = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  return {
    options: args.includes("closed") ? { open: false } : {},
    dropped: [
      ...args.filter((arg) => arg !== "closed").map(unknownWord),
      ...Object.keys(keys).map((key) => unknownWord(`${key}=`))
    ]
  };
};
var convertDetails = (text2) => {
  const words = text2.trim().split(/\s+/).filter(Boolean);
  const open = words.at(-1) === "open";
  const title = (open ? words.slice(0, -1) : words).join(" ");
  return {
    options: {
      ...title === "" ? {} : { title },
      ...open ? { open: true } : {}
    },
    dropped: []
  };
};
var convertFig = (text2) => {
  const { args } = parseMarkArgs(text2);
  return {
    options: args[0] === void 0 ? {} : { id: args[0] },
    dropped: args.slice(1).map(unknownWord)
  };
};
var convertRowDetail = (text2) => {
  const { args } = parseMarkArgs(text2);
  const at = Number(args[0]);
  if (Number.isInteger(at) && at >= 1) {
    return { options: { at }, dropped: [] };
  }
  return {
    options: {},
    dropped: [
      { text: args[0] ?? "", reason: "\u884C\u306E\u4F4D\u7F6E\u3092\u6570\u3068\u3057\u3066\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093" }
    ]
  };
};
var convertGallery = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  const dropped = args.map(unknownWord);
  const options = {};
  for (const [key, value] of Object.entries(keys)) {
    const count = Number(value);
    if (key !== "cols") {
      dropped.push(unknownWord(`${key}=`));
    } else if (Number.isInteger(count) && count >= 1 && count <= 6) {
      options.columns = count;
    } else {
      dropped.push({
        text: `cols=${value}`,
        reason: "\u5217\u306E\u6570\u306F 1\u301C6 \u306E\u6574\u6570\u3067\u3059"
      });
    }
  }
  return { options, dropped };
};
var convertFeatures = (text2) => {
  const options = {};
  const dropped = [];
  for (const arg of parseMarkArgs(text2).args) {
    if (/^[+-][a-z]/.test(arg)) options[arg.slice(1)] = arg.startsWith("+");
    else dropped.push(unknownWord(arg));
  }
  return { options, dropped };
};
var convertPage = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  const options = {};
  const dropped = args.map(unknownWord);
  for (const [key, value] of Object.entries(keys)) {
    const values = PAGE_VALUES[key];
    if (values === void 0) {
      dropped.push(unknownWord(`${key}=`));
    } else if (!values.includes(value)) {
      dropped.push({
        text: `${key}=${value}`,
        reason: `\u8A18\u8F09\u3067\u304D\u308B\u5024\u306F ${values.join("\u30FB")} \u3067\u3059`
      });
    } else {
      options[key] = key === "toc" ? { mode: value } : value;
    }
  }
  return { options, dropped };
};
var convertGlossary = (text2) => {
  const { args, keys } = parseMarkArgs(text2);
  const options = {};
  const dropped = args.map(unknownWord);
  for (const [key, value] of Object.entries(keys)) {
    if (["term", "meaning", "aliases", "avoid"].includes(key)) {
      options[key] = { column: value };
    } else {
      dropped.push(unknownWord(`${key}=`));
    }
  }
  return { options, dropped };
};
var converters;
var convertersOf = () => converters ??= {
  table: convertTable,
  tabs: (text2) => convertCollapseRange(text2, true),
  steps: (text2) => convertCollapseRange(text2, false),
  code: convertCode,
  tree: convertTree,
  view: convertView,
  include: convertInclude,
  section: convertSection,
  wide: convertWide,
  details: convertDetails,
  fig: convertFig,
  "row-detail": convertRowDetail,
  gallery: convertGallery,
  [FEATURES_MARK]: convertFeatures,
  [PAGE_MARK]: convertPage,
  glossary: convertGlossary
};
var convertByName = (options) => {
  const { name, text: text2 } = options;
  const table2 = convertersOf();
  const convert = Object.hasOwn(table2, name) ? table2[name] : void 0;
  return convert ? convert(text2) : { options: {}, dropped: [] };
};

// src/render/mark-options.ts
var isMarkOptions = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var jsonErrorIndex = (text2) => {
  let index = 0;
  const fail = (at) => {
    throw at;
  };
  const skip = () => {
    while (/\s/.test(text2[index] ?? "")) {
      index++;
    }
  };
  const literal = (word) => {
    for (const char of word) {
      if (text2[index] !== char) {
        fail(index);
      }
      index++;
    }
  };
  const string2 = () => {
    index++;
    while (index < text2.length && text2[index] !== '"') {
      index += text2[index] === "\\" ? 2 : 1;
    }
    if (index >= text2.length) {
      fail(text2.length);
    }
    index++;
  };
  const number = () => {
    const match = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text2.slice(index));
    if (!match) {
      fail(index);
    }
    index += match?.[0].length ?? 0;
  };
  const value = () => {
    skip();
    const char = text2[index];
    if (char === "{") {
      container("}", true);
    } else if (char === "[") {
      container("]", false);
    } else if (char === '"') {
      string2();
    } else if (char === "t") {
      literal("true");
    } else if (char === "f") {
      literal("false");
    } else if (char === "n") {
      literal("null");
    } else {
      number();
    }
  };
  const container = (close, keyed) => {
    index++;
    skip();
    if (text2[index] === close) {
      index++;
      return;
    }
    for (; ; ) {
      skip();
      if (keyed) {
        if (text2[index] !== '"') {
          fail(index);
        }
        string2();
        skip();
        if (text2[index] !== ":") {
          fail(index);
        }
        index++;
      }
      value();
      skip();
      if (text2[index] === ",") {
        index++;
        continue;
      }
      if (text2[index] === close) {
        index++;
        return;
      }
      fail(index);
    }
  };
  try {
    value();
    skip();
    return index < text2.length ? index : text2.length;
  } catch (at) {
    return typeof at === "number" ? Math.min(at, text2.length) : text2.length;
  }
};
var isUnquotedValue = (text2, position) => {
  const before = text2.slice(0, position).trimEnd();
  const char = text2[position] ?? "";
  return (before.endsWith(":") || before.endsWith(",") || before.endsWith("[")) && !/["\d{[\]tfn-]/.test(char);
};
var hasUnclosedString = (text2) => {
  let quotes = 0;
  for (let index = 0; index < text2.length; index++) {
    if (text2[index] === "\\") {
      index++;
      continue;
    }
    if (text2[index] === '"') {
      quotes++;
    }
  }
  return quotes % 2 === 1;
};
var jsonErrorMessage = (options) => {
  const { text: text2 } = options;
  if (hasUnclosedString(text2)) {
    return "\u306E\u5F15\u6570\u3092 JSON \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08\u6587\u5B57\u306E\u5024\u304C\u9589\u3058\u3066\u3044\u307E\u305B\u3093\uFF09\u3002\u5024\u306B `-->` \u3092\u8A18\u8F09\u3059\u308B\u3068\u3001\u30B3\u30E1\u30F3\u30C8\u304C\u305D\u3053\u3067\u9589\u3058\u307E\u3059\u3002`>` \u3092 `\\u003e` \u306B\u3057\u305F `--\\u003e` \u3067\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u65E2\u5B9A\u306E\u8A2D\u5B9A\u3067\u63CF\u3044\u3066\u3044\u307E\u3059\u3002";
  }
  const position = jsonErrorIndex(text2);
  if (position >= text2.length) {
    return "\u306E\u5F15\u6570\u3092 JSON \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u304C\u9589\u3058\u3066\u3044\u307E\u305B\u3093\uFF09\u3002`{` \u3068 `}` \u306E\u5BFE\u5FDC\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002\u65E2\u5B9A\u306E\u8A2D\u5B9A\u3067\u63CF\u3044\u3066\u3044\u307E\u3059\u3002";
  }
  const char = text2[position] ?? "";
  const where = `${position + 1} \u6587\u5B57\u76EE\u306E \`${char}\``;
  if (isUnquotedValue(text2, position)) {
    return `\u306E\u5F15\u6570\u3092 JSON \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08${where} \u3067\u3001\u5024\u306E\u6587\u5B57\u3092 \`"\` \u3067\u56F2\u3093\u3067\u3044\u307E\u305B\u3093\uFF09\u3002\u5024\u306E\u6587\u5B57\u306F \`"\` \u3067\u56F2\u3093\u3067\u304F\u3060\u3055\u3044\u3002\u65E2\u5B9A\u306E\u8A2D\u5B9A\u3067\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
  }
  if (char === "}" || char === "]") {
    return `\u306E\u5F15\u6570\u3092 JSON \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08${where} \u306E\u524D\u306B\u3001\u4F59\u5206\u306A \`,\` \u304C\u3042\u308A\u307E\u3059\uFF09\u3002\u6700\u5F8C\u306E\u5024\u306E\u5F8C\u308D\u306E \`,\` \u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u65E2\u5B9A\u306E\u8A2D\u5B9A\u3067\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
  }
  return `\u306E\u5F15\u6570\u3092 JSON \u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\uFF08${where}\uFF09\u3002JSON \u306E\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306E\u8A18\u8F09\u65B9\u6CD5\u3092\u78BA\u304B\u3081\u3066\u304F\u3060\u3055\u3044\u3002\u65E2\u5B9A\u306E\u8A2D\u5B9A\u3067\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
};
var readMarkArgs = (text2) => {
  const trimmed = text2.trim();
  if (trimmed === "") {
    return { kind: "none" };
  }
  if (!trimmed.startsWith("{")) {
    return { kind: "legacy", text: trimmed };
  }
  let value;
  try {
    value = JSON.parse(trimmed);
  } catch (error2) {
    return {
      kind: "invalid",
      message: jsonErrorMessage({ text: trimmed, error: error2 })
    };
  }
  if (!isMarkOptions(value)) {
    return {
      kind: "invalid",
      message: "\u306E\u5F15\u6570\u3092 JSON \u306E\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3068\u3057\u3066\u8AAD\u3081\u307E\u305B\u3093\u3002`{` \u3068 `}` \u3067\u56F2\u3093\u3060\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u65E2\u5B9A\u306E\u8A2D\u5B9A\u3067\u63CF\u3044\u3066\u3044\u307E\u3059\u3002"
    };
  }
  return { kind: "json", options: value };
};

// schemas/marks/code.schema.json
var code_schema_default = {
  $id: "code.schema.json",
  type: "object",
  properties: {
    title: {
      type: "string"
    },
    lines: {
      type: "object",
      properties: {
        start: {
          type: "integer",
          minimum: 0
        }
      },
      additionalProperties: false
    },
    highlight: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "integer",
            minimum: 1
          },
          {
            $ref: "common.schema.json#/$defs/line_range"
          }
        ]
      }
    },
    fold: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "integer",
            minimum: 1
          },
          {
            $ref: "common.schema.json#/$defs/line_range"
          }
        ]
      }
    },
    wrap: {
      type: "boolean"
    },
    tree_warning: {
      type: "boolean"
    },
    raw: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

// schemas/marks/common.schema.json
var common_schema_default = {
  $id: "common.schema.json",
  $defs: {
    collapse: {
      type: "object",
      properties: {
        open: {
          type: "boolean"
        },
        title: {
          type: "string"
        }
      },
      additionalProperties: false
    },
    line_range: {
      type: "object",
      properties: {
        from: {
          type: "integer",
          minimum: 1
        },
        to: {
          type: "integer",
          minimum: 1
        }
      },
      required: ["from"],
      additionalProperties: false
    },
    column_ref: {
      type: "object",
      properties: {
        column: {
          type: "string",
          minLength: 1
        }
      },
      required: ["column"],
      additionalProperties: false
    },
    feature: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean"
        }
      },
      additionalProperties: false
    }
  }
};

// schemas/marks/details.schema.json
var details_schema_default = {
  $id: "details.schema.json",
  type: "object",
  properties: {
    title: {
      type: "string"
    },
    open: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

// schemas/marks/features.schema.json
var features_schema_default = {
  $id: "features.schema.json",
  type: "object",
  properties: {},
  additionalProperties: {
    type: "boolean"
  }
};

// schemas/marks/fig.schema.json
var fig_schema_default = {
  $id: "fig.schema.json",
  type: "object",
  properties: {
    id: {
      type: "string"
    }
  },
  additionalProperties: false,
  required: ["id"]
};

// schemas/marks/gallery.schema.json
var gallery_schema_default = {
  $id: "gallery.schema.json",
  type: "object",
  properties: {
    columns: {
      type: "integer",
      minimum: 1,
      maximum: 6
    }
  },
  additionalProperties: false
};

// schemas/marks/glossary.schema.json
var glossary_schema_default = {
  $id: "glossary.schema.json",
  type: "object",
  properties: {
    term: {
      $ref: "common.schema.json#/$defs/column_ref"
    },
    meaning: {
      $ref: "common.schema.json#/$defs/column_ref"
    },
    aliases: {
      $ref: "common.schema.json#/$defs/column_ref"
    },
    avoid: {
      $ref: "common.schema.json#/$defs/column_ref"
    },
    alias_row: {
      type: "string",
      minLength: 1
    }
  },
  additionalProperties: false
};

// schemas/marks/include.schema.json
var include_schema_default = {
  $id: "include.schema.json",
  type: "object",
  properties: {
    path: {
      type: "string"
    },
    heading: {
      type: "string"
    },
    lines: {
      $ref: "common.schema.json#/$defs/line_range"
    }
  },
  additionalProperties: false,
  required: ["path"]
};

// schemas/marks/page.schema.json
var page_schema_default = {
  $id: "page.schema.json",
  type: "object",
  properties: {
    scheme: {
      type: "string",
      enum: ["light", "dark", "auto"]
    },
    theme: {
      type: "string",
      enum: ["dev-swiss", "theme-paper", "theme-slate", "theme-contrast"]
    },
    toc: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["hover", "fixed"]
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

// schemas/marks/row-detail.schema.json
var row_detail_schema_default = {
  $id: "row-detail.schema.json",
  type: "object",
  properties: {
    at: {
      type: "integer",
      minimum: 1
    }
  },
  additionalProperties: false,
  required: ["at"]
};

// schemas/marks/section.schema.json
var section_schema_default = {
  $id: "section.schema.json",
  type: "object",
  properties: {
    open: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

// schemas/marks/steps.schema.json
var steps_schema_default = {
  $id: "steps.schema.json",
  type: "object",
  properties: {
    collapse: {
      $ref: "common.schema.json#/$defs/collapse"
    }
  },
  additionalProperties: false
};

// schemas/marks/table.schema.json
var table_schema_default = {
  $id: "table.schema.json",
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: ["data", "plain"]
    },
    features: {
      type: "object",
      properties: {
        sort: {
          $ref: "common.schema.json#/$defs/feature"
        },
        pin: {
          $ref: "common.schema.json#/$defs/feature"
        },
        filter: {
          $ref: "common.schema.json#/$defs/feature"
        },
        resize: {
          $ref: "common.schema.json#/$defs/feature"
        },
        count: {
          $ref: "common.schema.json#/$defs/feature"
        },
        columns: {
          $ref: "common.schema.json#/$defs/feature"
        },
        reorder: {
          $ref: "common.schema.json#/$defs/feature"
        },
        total: {
          $ref: "common.schema.json#/$defs/feature"
        },
        copy: {
          $ref: "common.schema.json#/$defs/feature"
        },
        rowlink: {
          $ref: "common.schema.json#/$defs/feature"
        }
      },
      additionalProperties: false
    },
    columns: {
      type: "object",
      properties: {},
      additionalProperties: {
        type: "object",
        properties: {
          filter: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["select", "text", "date"]
              }
            },
            additionalProperties: false
          },
          hidden: {
            type: "boolean"
          },
          pinned: {
            type: "boolean"
          },
          sort: {
            type: "boolean"
          },
          total: {
            type: "array",
            items: {
              type: "object",
              properties: {
                calc: {
                  type: "string",
                  enum: ["sum", "avg", "count"]
                }
              },
              additionalProperties: false,
              required: ["calc"]
            }
          },
          width: {
            type: "object",
            properties: {
              mode: {
                type: "string",
                enum: ["auto", "nowrap"]
              },
              min: {
                type: "number",
                minimum: 0
              },
              max: {
                type: "number",
                minimum: 0
              }
            },
            additionalProperties: false
          },
          format: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["check"]
              }
            },
            additionalProperties: false,
            required: ["type"]
          },
          highlight: {
            type: "object",
            properties: {
              color: {
                type: "string",
                enum: [
                  "blue",
                  "red",
                  "green",
                  "yellow",
                  "orange",
                  "purple",
                  "gray"
                ]
              }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    },
    header: {
      type: "object",
      properties: {
        rows: {
          type: "integer",
          minimum: 1
        },
        columns: {
          type: "integer",
          minimum: 0
        }
      },
      additionalProperties: false
    },
    rows: {
      type: "object",
      properties: {
        colors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              column: {
                type: "string"
              },
              value: {
                type: "string"
              },
              at: {
                anyOf: [
                  {
                    type: "integer",
                    minimum: 1
                  },
                  {
                    $ref: "common.schema.json#/$defs/line_range"
                  }
                ]
              },
              color: {
                type: "string",
                enum: [
                  "blue",
                  "red",
                  "green",
                  "yellow",
                  "orange",
                  "purple",
                  "gray"
                ]
              }
            },
            additionalProperties: false,
            required: ["color"]
          }
        }
      },
      additionalProperties: false
    },
    tree: {
      type: "object",
      properties: {
        key: {
          $ref: "common.schema.json#/$defs/column_ref"
        },
        type: {
          $ref: "common.schema.json#/$defs/column_ref"
        },
        required: {
          $ref: "common.schema.json#/$defs/column_ref"
        },
        default: {
          $ref: "common.schema.json#/$defs/column_ref"
        },
        example: {
          type: "object",
          properties: {
            heading: {
              type: "string"
            }
          },
          additionalProperties: false,
          required: ["heading"]
        }
      },
      additionalProperties: false,
      required: ["key"]
    },
    collapse: {
      $ref: "common.schema.json#/$defs/collapse"
    }
  },
  additionalProperties: false
};

// schemas/marks/tabs.schema.json
var tabs_schema_default = {
  $id: "tabs.schema.json",
  type: "object",
  properties: {
    group: {
      type: "string",
      minLength: 1
    },
    collapse: {
      $ref: "common.schema.json#/$defs/collapse"
    }
  },
  additionalProperties: false
};

// schemas/marks/tree.schema.json
var tree_schema_default = {
  $id: "tree.schema.json",
  type: "object",
  properties: {
    depth: {
      anyOf: [
        {
          type: "string",
          enum: ["all"]
        },
        {
          type: "integer",
          minimum: 1
        }
      ]
    },
    wrap: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

// schemas/marks/view.schema.json
var view_schema_default = {
  $id: "view.schema.json",
  type: "object",
  properties: {
    board: {
      type: "object",
      properties: {
        group: {
          $ref: "common.schema.json#/$defs/column_ref"
        },
        values: {
          type: "object",
          properties: {},
          additionalProperties: {
            type: "object",
            properties: {
              icon: {
                type: "string",
                enum: [
                  "circle-dashed",
                  "circle-dot",
                  "circle-pause",
                  "circle-check",
                  "circle-x",
                  "circle",
                  "inbox",
                  "archive",
                  "clock",
                  "flag",
                  "star",
                  "bug",
                  "eye",
                  "lock",
                  "zap",
                  "ban"
                ]
              }
            },
            additionalProperties: false
          }
        }
      },
      additionalProperties: false,
      required: ["group"]
    },
    initial: {
      type: "string",
      enum: ["board", "table"]
    },
    columns: {
      type: "object",
      properties: {},
      additionalProperties: {
        type: "object",
        properties: {
          filter: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["select", "text", "date"]
              }
            },
            additionalProperties: false
          },
          sort: {
            type: "boolean"
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};

// schemas/marks/wide.schema.json
var wide_schema_default = {
  $id: "wide.schema.json",
  type: "object",
  properties: {
    open: {
      type: "boolean"
    }
  },
  additionalProperties: false
};

// src/render/mark-schema.ts
var withCommon = (schema4) => ({
  ...schema4,
  $defs: common_schema_default.$defs ?? {}
});
var MARK_SCHEMAS = {
  code: withCommon(code_schema_default),
  details: withCommon(details_schema_default),
  features: withCommon(features_schema_default),
  fig: withCommon(fig_schema_default),
  gallery: withCommon(gallery_schema_default),
  glossary: withCommon(glossary_schema_default),
  include: withCommon(include_schema_default),
  page: withCommon(page_schema_default),
  "row-detail": withCommon(row_detail_schema_default),
  section: withCommon(section_schema_default),
  steps: withCommon(steps_schema_default),
  table: withCommon(table_schema_default),
  tabs: withCommon(tabs_schema_default),
  tree: withCommon(tree_schema_default),
  view: withCommon(view_schema_default),
  wide: withCommon(wide_schema_default)
};
var REMOVED = /* @__PURE__ */ Symbol("removed");
var resolve = (node, root) => {
  if (node.$ref === void 0) {
    return node;
  }
  const name = node.$ref.replace(/^.*#\/\$defs\//, "");
  const target = root.$defs?.[name];
  if (target === void 0) {
    throw new Error(
      `\u30DE\u30FC\u30AB\u30FC\u306E JSON Schema \u306E $ref \u3092\u89E3\u3051\u307E\u305B\u3093: ${node.$ref}`
    );
  }
  return resolve(target, root);
};
var childPath = (path, key) => typeof key === "number" ? `${path}[${key}]` : path === "" ? key : `${path}.${key}`;
var show = (value) => JSON.stringify(value);
var showChoice = (value) => typeof value === "string" ? value : JSON.stringify(value);
var DECIDING_KEYS = {
  filter: ["type"]
};
var exampleObject = (resolved, root) => {
  const [first] = Object.entries(resolved.properties ?? {});
  return first ? { [first[0]]: exampleOf(first[1], root) } : {};
};
var exampleOfType = (resolved, root) => {
  switch (resolved.type) {
    case "object":
      return exampleObject(resolved, root);
    case "array":
      return resolved.items ? [exampleOf(resolved.items, root)] : [];
    case "string":
      return "\u6587\u5B57";
    case "integer":
    case "number":
      return Math.max(resolved.minimum ?? 1, 1);
    case "boolean":
      return false;
    default:
      return null;
  }
};
var exampleOf = (node, root) => {
  const resolved = resolve(node, root);
  if (resolved.anyOf?.[0]) {
    return exampleOf(resolved.anyOf[0], root);
  }
  if (resolved.enum?.[0] !== void 0) {
    return resolved.enum[0];
  }
  return exampleOfType(resolved, root);
};
var expectedInteger = (resolved) => {
  const { minimum, maximum } = resolved;
  if (minimum !== void 0 && maximum !== void 0) {
    return `${minimum}\u301C${maximum} \u306E\u6574\u6570`;
  }
  return minimum !== void 0 ? `${minimum} \u4EE5\u4E0A\u306E\u6574\u6570` : "\u6574\u6570";
};
var expectedObject = (resolved) => {
  const keys = Object.keys(resolved.properties ?? {});
  return keys.length > 0 ? `${keys.map((key) => `\`${key}\``).join("\u30FB")} \u3092\u6301\u3064\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8` : "\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8";
};
var expectedOfType = (resolved) => {
  switch (resolved.type) {
    case "object":
      return expectedObject(resolved);
    case "array":
      return "\u914D\u5217";
    case "string":
      return resolved.minLength !== void 0 && resolved.minLength > 0 ? `${resolved.minLength} \u6587\u5B57\u4EE5\u4E0A\u306E\u6587\u5B57` : "\u6587\u5B57";
    case "integer":
      return expectedInteger(resolved);
    case "number":
      return resolved.minimum !== void 0 ? `${resolved.minimum} \u4EE5\u4E0A\u306E\u6570` : "\u6570";
    case "boolean":
      return "`true` \u304B `false`";
    default:
      return "\u5024";
  }
};
var expectedOf = (node, root) => {
  const resolved = resolve(node, root);
  if (resolved.anyOf) {
    return resolved.anyOf.map((item) => expectedOf(item, root)).join("\u304B\u3001");
  }
  if (resolved.enum) {
    return `${resolved.enum.map((value) => `\`${show(value)}\``).join("\u30FB")} \u306E\u3069\u308C\u304B`;
  }
  return expectedOfType(resolved);
};
var matchesType = (type, value) => {
  switch (type) {
    case void 0:
      return true;
    case "object":
      return isMarkOptions(value);
    case "array":
      return Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
};
var mismatchMessage = (node, at) => {
  const { root, value, path } = at;
  const resolved = resolve(node, root);
  if (resolved.enum && matchesType(resolved.type, value)) {
    const values = resolved.enum.map((item) => `\`${showChoice(item)}\``).join("\u30FB");
    return `\u306E \`${path}\` \u306E \`${showChoice(value)}\` \u306F\u9078\u3079\u308B\u5024\u306B\u3042\u308A\u307E\u305B\u3093\u3002\u9078\u3079\u308B\u5024\u306F ${values} \u3067\u3059\u3002\u3053\u306E\u8A2D\u5B9A\u3092\u5F53\u3066\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
  }
  return `\u306E \`${path}\` \u306B\u306F ${expectedOf(node, root)} \u3092\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B \`${show(exampleOf(node, root))}\`\uFF09\u3002\u3053\u306E\u8A2D\u5B9A\u3092\u5F53\u3066\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
};
var invalidResult = (node, at) => ({
  value: REMOVED,
  problems: [{ path: at.path, message: mismatchMessage(node, at) }],
  unknownKeys: []
});
var outOfRange = (resolved, value) => {
  if (typeof value === "number") {
    return resolved.minimum !== void 0 && value < resolved.minimum || resolved.maximum !== void 0 && value > resolved.maximum;
  }
  return typeof value === "string" && resolved.minLength !== void 0 && value.length < resolved.minLength;
};
var violates = (resolved, value) => !matchesType(resolved.type, value) || resolved.enum !== void 0 && !resolved.enum.includes(value) || resolved.const !== void 0 && resolved.const !== value || outOfRange(resolved, value);
var checkAnyOf = (node, context) => {
  for (const alternative of context.alternatives) {
    const result = check(alternative, context.at);
    if (result.value !== REMOVED && result.problems.length === 0) {
      return result;
    }
  }
  return invalidResult(node, context.at);
};
var check = (node, at) => {
  const { root, value, path } = at;
  const resolved = resolve(node, root);
  if (resolved.anyOf) {
    return checkAnyOf(node, { alternatives: resolved.anyOf, at });
  }
  if (violates(resolved, value)) {
    return invalidResult(node, at);
  }
  if (Array.isArray(value)) {
    return checkArray(resolved, { root, value, path });
  }
  if (isMarkOptions(value) && resolved.type === "object") {
    return checkObject(resolved, { root, value, path });
  }
  return { value, problems: [], unknownKeys: [] };
};
var checkArray = (node, at) => {
  const { root, value, path } = at;
  const out = [];
  const problems = [];
  const unknownKeys = [];
  value.forEach((item, index) => {
    const result = node.items ? check(node.items, { root, value: item, path: childPath(path, index) }) : { value: item, problems: [], unknownKeys: [] };
    problems.push(...result.problems);
    unknownKeys.push(...result.unknownKeys);
    if (result.value !== REMOVED) {
      out.push(result.value);
    }
  });
  return { value: out, problems, unknownKeys };
};
var propertySchemaOf = (node, key) => node.properties?.[key] ?? (typeof node.additionalProperties === "object" ? node.additionalProperties : void 0);
var checkProperties = (node, at) => {
  const { root, value, path } = at;
  const out = {};
  const problems = [];
  const unknownKeys = [];
  const removed = /* @__PURE__ */ new Set();
  for (const [key, child] of Object.entries(value)) {
    const schema4 = propertySchemaOf(node, key);
    if (schema4 === void 0) {
      unknownKeys.push(childPath(path, key));
      continue;
    }
    const result = check(schema4, {
      root,
      value: child,
      path: childPath(path, key)
    });
    problems.push(...result.problems);
    unknownKeys.push(...result.unknownKeys);
    if (result.value === REMOVED) {
      removed.add(key);
    } else {
      out[key] = result.value;
    }
  }
  return { value: out, problems, unknownKeys, removed };
};
var missingProblems = (node, at) => {
  const { root, value, path } = at;
  return (node.required ?? []).filter((key) => !Object.hasOwn(value, key)).map((key) => {
    const property = node.properties?.[key];
    const example = property ? ` \`${show({ [key]: exampleOf(property, root) })}\` \u306E\u3088\u3046\u306B\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002` : "";
    const owner = path === "" ? "" : `\u306E \`${path}\` `;
    return {
      path: childPath(path, key),
      message: `${owner}\u306B\u5FC5\u9808\u306E \`${key}\` \u304C\u3042\u308A\u307E\u305B\u3093\u3002${example}\u3053\u306E\u8A2D\u5B9A\u3092\u5F53\u3066\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`
    };
  });
};
var removesOwner = (node, context) => {
  const { path, removed } = context;
  if (path === "") {
    return false;
  }
  const owner = path.split(/\.|\[\d+\]/).filter(Boolean).at(-1) ?? "";
  return [...node.required ?? [], ...DECIDING_KEYS[owner] ?? []].some(
    (key) => removed.has(key)
  );
};
var checkObject = (node, at) => {
  const { path } = at;
  const { removed, ...checked } = checkProperties(node, at);
  const missing = missingProblems(node, at);
  checked.problems.push(...missing);
  if (missing.length > 0 && path !== "" || removesOwner(node, { path, removed })) {
    return { ...checked, value: REMOVED };
  }
  return checked;
};
var validateMarkOptions = (options) => {
  const schema4 = MARK_SCHEMAS[options.name];
  if (schema4 === void 0) {
    return { options: options.options, problems: [], unknownKeys: [] };
  }
  const result = checkObject(resolve(schema4, schema4), {
    root: schema4,
    value: options.options,
    path: ""
  });
  const checked = isMarkOptions(result.value) ? result.value : {};
  if (options.name === "features") {
    for (const key of Object.keys(checked)) {
      if (!Object.hasOwn(DEFAULT_FEATURES, key)) {
        delete checked[key];
        result.unknownKeys.push(key);
      }
    }
  }
  return {
    options: checked,
    problems: result.problems,
    unknownKeys: result.unknownKeys
  };
};
var segmentSchemaOf = (node, context) => {
  const resolved = resolve(node, context.schema);
  const child = resolved.properties?.[context.segment] ?? (typeof resolved.additionalProperties === "object" ? resolved.additionalProperties : resolved.items);
  return child?.items && !child.properties ? child.items : child;
};
var usableKeysAt = (schema4, path) => {
  const segments = path.split(/\.|\[\d+\]/).filter(Boolean);
  segments.pop();
  let node = resolve(schema4, schema4);
  for (const segment of segments) {
    if (node === void 0) {
      return [];
    }
    node = segmentSchemaOf(node, { schema: schema4, segment });
  }
  if (node === void 0) {
    return [];
  }
  const resolved = resolve(node, schema4);
  return Object.keys(resolved.properties ?? {});
};
var COLUMN_FEATURES = {
  filter: "filter",
  hidden: "columns",
  pinned: "pin",
  total: "total"
};
var unappliedTableNotes = (options) => {
  const notes = [];
  const features = isMarkOptions(options.features) ? options.features : {};
  const disabled = new Set(
    Object.entries(features).filter(([, value]) => isMarkOptions(value) && value.enabled === false).map(([name]) => name)
  );
  const columns = isMarkOptions(options.columns) ? options.columns : {};
  for (const [column, settings] of Object.entries(columns)) {
    if (!isMarkOptions(settings)) {
      continue;
    }
    for (const key of Object.keys(settings)) {
      const feature = COLUMN_FEATURES[key];
      if (feature !== void 0 && disabled.has(feature)) {
        notes.push({
          kind: "mark_option_unapplied",
          message: `\u8868\u306E\u30DE\u30FC\u30AB\u30FC\u306E columns.${column}.${key} \u306F\u3001features.${feature}.enabled \u3092 false \u306B\u3057\u305F\u6A5F\u80FD\u306E\u8A2D\u5B9A\u306E\u305F\u3081\u9069\u7528\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u6A5F\u80FD\u3092\u524A\u9664\u3057\u306A\u3044\u304B\u3001\u5217\u306E\u8A2D\u5B9A\u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
        });
      }
    }
  }
  const rows = isMarkOptions(options.rows) ? options.rows : {};
  const colors = Array.isArray(rows.colors) ? rows.colors : [];
  colors.forEach((item, index) => {
    if (!isMarkOptions(item)) {
      return;
    }
    const hasColumn = item.column !== void 0;
    const hasValue = item.value !== void 0;
    if (hasColumn !== hasValue || !hasColumn && item.at === void 0) {
      notes.push({
        kind: "mark_option_unapplied",
        message: `\u8868\u306E\u30DE\u30FC\u30AB\u30FC\u306E rows.colors[${index}] \u306F\u3001column \u3068 value \u306E\u4E21\u65B9\u304B at \u3092\u8A18\u8F09\u3057\u3066\u3044\u306A\u3044\u305F\u3081\u9069\u7528\u3057\u3066\u3044\u307E\u305B\u3093\u3002column \u3068 value \u3092\u4E21\u65B9\u8A18\u8F09\u3059\u308B\u304B\u3001at \u3092\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
      });
    }
  });
  return notes;
};
var markOptionNotes = (options) => {
  const { name } = options;
  if (options.source === "legacy") {
    return [
      {
        kind: "legacy_mark",
        message: options.isExtension ? `${name} \u306E\u30DE\u30FC\u30AB\u30FC\u306E\u5F15\u6570\u304C\u4ECA\u306E\u66F8\u304D\u65B9\u3067\u3059\u3002\u62E1\u5F35\u3068 libraries \u306E\u30DE\u30FC\u30AB\u30FC\u306F\u3001\u4ECA\u306E\u66F8\u304D\u65B9\u306E\u5F15\u6570\u3067\u306F\u63CF\u304B\u306A\u3044\u305F\u3081\u3001\u63CF\u304F\u3068\u304D\u306B\u63CF\u304D\u307E\u305B\u3093\u3002mdmark upgrade \u306F\u66F8\u304D\u63DB\u3048\u305A\u306B\u79FB\u884C\u306E\u5831\u544A\u306B\u6319\u3052\u308B\u306E\u3067\u3001\u5F15\u6570\u3092 JSON \u306E\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u8A18\u8F09\u3057\u76F4\u3057\u3066\u304F\u3060\u3055\u3044\u3002` : `${name} \u306E\u30DE\u30FC\u30AB\u30FC\u306E\u5F15\u6570\u304C\u4ECA\u306E\u66F8\u304D\u65B9\u3067\u3059\u3002\u5F15\u6570\u3092 JSON \u306E\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002mdmark upgrade \u3067\u66F8\u304D\u63DB\u3048\u3089\u308C\u307E\u3059\u3002`
      }
    ];
  }
  if (options.isExtension) {
    return [];
  }
  const schema4 = MARK_SCHEMAS[name];
  const notes = options.unknownKeys.map((path) => {
    const usable = name === "features" ? Object.keys(DEFAULT_FEATURES).join("\u30FB") : schema4 === void 0 ? "" : usableKeysAt(schema4, path).join("\u30FB");
    return {
      kind: "unknown_mark_arg",
      message: `${name} \u306E\u30DE\u30FC\u30AB\u30FC\u306E ${path} \u306F\u3053\u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u306E mdmark \u304C\u77E5\u3089\u306A\u3044\u30AD\u30FC\u3067\u3001\u63CF\u304F\u3068\u304D\u306F\u7121\u8996\u3057\u3066\u3044\u307E\u3059\u3002\u3053\u306E\u5834\u6240\u3067\u4F7F\u7528\u3067\u304D\u308B\u30AD\u30FC\u306F ${usable} \u3067\u3059\u3002\u8AA4\u8A18\u306A\u3089\u30AD\u30FC\u3092\u4FEE\u6B63\u3057\u3001\u65B0\u3057\u3044\u30D0\u30FC\u30B8\u30E7\u30F3\u306E\u30AD\u30FC\u306A\u3089 mdmark \u306E\u30D0\u30FC\u30B8\u30E7\u30F3\u3092\u4E0A\u3052\u3066\u304F\u3060\u3055\u3044\u3002`
    };
  });
  if (name === "table") {
    notes.push(...unappliedTableNotes(options.options));
  }
  return notes;
};

// src/render/marks.ts
var MARK_PATTERN = /<!--\s*(\/)?([a-z][a-z0-9-]*)(?::\s*(.*?))?\s*-->/gs;
var FEATURES_MARK = "features";
var PAGE_MARK = "page";
var SYNTAX_MARKS = {
  table: "table",
  tabs: "tabs",
  steps: "steps",
  tree: "tree",
  section: "sections",
  "row-detail": "row-details",
  fig: "figures",
  toc: "toc",
  glossary: "glossary",
  view: "views",
  flow: "diagrams",
  sequence: "diagrams",
  chart: "diagrams",
  param: "diagrams",
  er: "diagrams",
  html: "html",
  code: "code",
  gallery: "gallery",
  columns: "columns",
  column: "columns",
  details: "details",
  pagebreak: "pagebreak",
  include: "include",
  wide: "wide",
  cards: "card-grid",
  map: "map",
  "map-data": "map"
};
var DIAGRAM_MARKS = ["flow", "sequence", "chart", "param", "er"];
var MARK_TOKEN = "mdmark_mark";
function parseMarkArgs(text2) {
  const value = { args: [], keys: {} };
  for (const part of text2.split(/\s+/).filter(Boolean)) {
    const pair = /^([^\s=]+)=(.*)$/.exec(part);
    if (pair?.[1] !== void 0) {
      value.keys[pair[1]] = pair[2] ?? "";
    } else {
      value.args.push(part);
    }
  }
  return value;
}
var UNVALIDATED_MARKS = /* @__PURE__ */ new Set(["map", "map-data"]);
function isEmbedMark(name, env) {
  return extensionFor(name) !== void 0 || env !== void 0 && Object.hasOwn(env.libraries, name);
}
function isOwnMark(name) {
  return name === FEATURES_MARK || name === PAGE_MARK || Object.hasOwn(SYNTAX_MARKS, name);
}
function emptyMark(base2, source) {
  return { ...base2, options: {}, source, problems: [], unknownKeys: [] };
}
function legacyMark(base2, text2) {
  const { name } = base2;
  if (!isOwnMark(name) || UNVALIDATED_MARKS.has(name)) {
    return emptyMark(base2, "legacy");
  }
  const converted = convertLegacyArgs({ name, text: text2 });
  const checked = validateMarkOptions({ name, options: converted.options });
  return {
    ...base2,
    options: checked.options,
    source: "legacy",
    problems: converted.dropped.map((item) => ({
      path: item.text,
      message: item.reason
    })),
    unknownKeys: []
  };
}
function jsonMark(base2, options) {
  const { name } = base2;
  if (UNVALIDATED_MARKS.has(name) || !isOwnMark(name)) {
    return { ...base2, options, source: "json", problems: [], unknownKeys: [] };
  }
  const checked = validateMarkOptions({ name, options });
  return {
    ...base2,
    options: checked.options,
    source: "json",
    problems: checked.problems,
    unknownKeys: checked.unknownKeys
  };
}
function toMark(raw, parts) {
  const { closing, name, rest } = parts;
  const base2 = { name, raw, closing: closing === "/", rest: rest ?? "" };
  if (base2.closing || UNVALIDATED_MARKS.has(name)) {
    return emptyMark(base2, "none");
  }
  const args = readMarkArgs(rest ?? "");
  switch (args.kind) {
    case "none":
      return emptyMark(base2, "none");
    case "invalid":
      return {
        ...emptyMark(base2, "invalid"),
        problems: [{ path: "", message: args.message }]
      };
    case "legacy":
      return legacyMark(base2, args.text);
    case "json":
      return jsonMark(base2, args.options);
    default:
      return args;
  }
}
function withLine(warning, line) {
  return { ...warning, ...line === void 0 ? {} : { line } };
}
function markProblemWarning(mark) {
  const [first, ...others] = mark.problems;
  if (first === void 0) {
    return void 0;
  }
  if (mark.source === "legacy") {
    return {
      mark: mark.raw,
      message: "\u306E\u8AAD\u307F\u8FBC\u3081\u306A\u3044\u6307\u5B9A\u3092\u5F53\u3066\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002",
      items: mark.problems.map((problem) => ({
        label: problem.path,
        message: problem.message
      }))
    };
  }
  if (others.length === 0) {
    return { mark: mark.raw, message: first.message };
  }
  const items = mark.problems.map((problem) => ({
    label: problem.path,
    message: problem.message.replace(
      /^(?:の `[^`]*` (?:の |には |に)?|に)/,
      ""
    )
  }));
  return {
    mark: mark.raw,
    message: "\u306E\u8AAD\u307F\u8FBC\u3081\u306A\u3044\u6307\u5B9A\u3092\u5F53\u3066\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002",
    items
  };
}
function featureOptionsOf(text2, mark) {
  const args = readMarkArgs(text2);
  const options = args.kind === "json" ? args.options : mark.options;
  return Object.fromEntries(
    Object.entries(options).filter(
      (entry) => typeof entry[1] === "boolean"
    )
  );
}
function notesOf(mark, env) {
  if (mark.closing) {
    return [];
  }
  const isExtension = isEmbedMark(mark.name, env) && !isOwnMark(mark.name);
  if (!isExtension && (!isOwnMark(mark.name) || UNVALIDATED_MARKS.has(mark.name))) {
    return [];
  }
  return markOptionNotes({
    name: mark.name,
    source: mark.source,
    options: mark.options,
    unknownKeys: mark.unknownKeys,
    isExtension
  });
}
function legacyEmbedWarning(mark) {
  const example = mark.rest ? ` \`<!-- ${mark.name}: {"\u2026": "${mark.rest.replaceAll('"', "'").split(/\s+/)[0] ?? ""}"} -->\`` : "";
  return {
    mark: mark.raw,
    message: `\u306E\u5F15\u6570\u306F JSON \u306E\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u4F8B:${example}\uFF09\u3002\u62E1\u5F35 \`${mark.name}\` \u306E\u90E8\u54C1\u306F\u63CF\u3044\u3066\u3044\u307E\u305B\u3093\u3002\`mdmark upgrade\` \u306E\u79FB\u884C\u306E\u5831\u544A\u3067\u3001\u8A18\u8F09\u3057\u76F4\u3059\u7B87\u6240\u3092\u78BA\u304B\u3081\u3089\u308C\u307E\u3059\u3002`
  };
}
function replaceMarks(html, env, context) {
  return html.replace(
    MARK_PATTERN,
    (raw, ...groups) => {
      const [closing, name = "", rest] = groups;
      const mark = toMark(raw, { closing, name, rest });
      if (mark.closing) {
        return "";
      }
      if (context.line !== void 0) {
        recordMarkNotes(env, {
          notes: notesOf(mark, env),
          line: context.line + 1
        });
      }
      return replacementOf(mark, { env, warnings: context.warnings });
    }
  );
}
function replacementOf(mark, context) {
  const { env, warnings } = context;
  if (mark.name === FEATURES_MARK) {
    env.featureOptions.push(featureOptionsOf(mark.rest ?? "", mark));
    const warning = markProblemWarning(mark);
    if (warning) {
      warnings.push(warning);
    }
    return "";
  }
  return isEmbedMark(mark.name, env) ? embedOf(mark, context) : "";
}
function embedOf(mark, context) {
  if (mark.source === "legacy") {
    context.warnings.push(legacyEmbedWarning(mark));
    return "";
  }
  if (mark.source === "invalid") {
    const warning = markProblemWarning(mark);
    if (warning) {
      context.warnings.push(warning);
    }
    return "";
  }
  return markOwn(
    renderEmbed({ name: mark.name, options: mark.options }),
    context.env.nonce
  );
}
function soleMark(content) {
  const matches2 = [...content.matchAll(MARK_PATTERN)];
  const [only] = matches2;
  if (matches2.length !== 1 || !only || content.replace(MARK_PATTERN, "").trim()) {
    return void 0;
  }
  return toMark(only[0], {
    closing: only[1],
    name: only[2] ?? "",
    rest: only[3]
  });
}
function soleSyntaxMark(content, env) {
  const mark = soleMark(content);
  if (!mark || !Object.hasOwn(SYNTAX_MARKS, mark.name)) {
    return void 0;
  }
  const overridden = DIAGRAM_MARKS.includes(mark.name) && (extensionFor(mark.name) || Object.hasOwn(env.libraries, mark.name));
  return overridden ? void 0 : mark;
}
function isJsonFence(token) {
  return token.type === "fence" && token.info.trim().split(/\s+/)[0] === "json";
}
function closeOf(tokens, index, mark) {
  const level = tokens[index]?.level;
  return tokens.findIndex((token, position) => {
    if (position <= index || token.type !== "html_block") {
      return false;
    }
    const other = soleMark(token.content);
    return token.level === level && other?.closing === true && other.name === mark.name;
  });
}
function isHandledMark(name, env) {
  return name === FEATURES_MARK || name === PAGE_MARK || Object.hasOwn(SYNTAX_MARKS, name) || Object.hasOwn(env.libraries, name);
}
function ownHtmlBlock(state, html) {
  const token = new state.Token("html_block", "", 0);
  token.block = true;
  token.content = markOwn(html, state.env.nonce);
  return token;
}
function readFence(fences, extensionName) {
  const [fence2] = fences;
  if (!fence2 || fences.length > 1) {
    return {
      ok: false,
      message: `\u306E\u7BC4\u56F2\u306B json \u306E\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u304C ${fences.length} \u3064\u3042\u308A\u307E\u3059\u3002\u90E8\u54C1\u306E\u5B9A\u7FA9\u306F 1 \u3064\u3060\u3051\u914D\u7F6E\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u62E1\u5F35 \`${extensionName}\` \u306E\u90E8\u54C1\u306F\u63CF\u3044\u3066\u3044\u307E\u305B\u3093\u3002`
    };
  }
  const parsed = parseDefinitionJson(fence2.content);
  if (parsed.ok) {
    return { ok: true, value: parsed.value };
  }
  const after = parsed.after.replaceAll("`", "'");
  const where = `${parsed.line} \u884C\u76EE\u306E ${after} \u306E\u5F8C`;
  const detail = parsed.missing === "" ? `${where}\u304C\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093` : `${where}\u306B ${parsed.missing} \u304C\u3042\u308A\u307E\u305B\u3093`;
  return {
    ok: false,
    message: `\u306E\u90E8\u54C1\u306E\u5B9A\u7FA9\u3092 JSON \u3068\u3057\u3066\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\uFF08${detail}\uFF09\u3002\u62E1\u5F35 \`${extensionName}\` \u306E\u90E8\u54C1\u306F\u63CF\u3044\u3066\u3044\u307E\u305B\u3093\u3002`
  };
}
function extensionSlot(options) {
  const { state, mark, fences, extensionName, line } = options;
  const env = state.env;
  const read = readFence(fences, extensionName);
  if (!read.ok) {
    return warningBlock(
      state,
      withLine({ mark: mark.raw, message: read.message }, line)
    );
  }
  if (mark.source === "legacy" || mark.source === "invalid") {
    return warningBlock(
      state,
      withLine(markProblemWarning(mark) ?? legacyEmbedWarning(mark), line)
    );
  }
  env.extensionDefinitions ??= [];
  const definition = env.extensionDefinitions.push(read.value) - 1;
  return ownHtmlBlock(
    state,
    renderEmbed({ name: mark.name, options: mark.options, definition })
  );
}
function takeDefinitionRanges(state) {
  const env = state.env;
  const tokens = state.tokens;
  const out = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const mark = token.type === "html_block" ? soleMark(token.content) : void 0;
    const extension = mark ? extensionFor(mark.name) : void 0;
    if (!mark || mark.closing || !extension && isHandledMark(mark.name, env)) {
      out.push(token);
      continue;
    }
    index = takeDefinitionRange(state, {
      tokens,
      index,
      mark,
      extension,
      out
    });
  }
  state.tokens = out;
}
function takeDefinitionRange(state, range) {
  const { tokens, index, mark, extension, out } = range;
  const token = tokens[index];
  const closeIndex = closeOf(tokens, index, mark);
  const inner = closeIndex < 0 ? [] : tokens.slice(index + 1, closeIndex);
  const fences = inner.filter(isJsonFence);
  if (extension && fences.length > 0) {
    out.push(
      extensionSlot({
        state,
        mark,
        fences,
        extensionName: extension.name,
        line: token.map?.[0]
      })
    );
    return closeIndex;
  }
  if (!extension && inner.length > 0 && fences.length === inner.length) {
    return closeIndex;
  }
  out.push(token);
  return index;
}
function isMarksOnly(token) {
  return token.type === "html_block" && token.content.replace(MARK_PATTERN, "").trim() === "";
}
function takePageMarks(state) {
  let atTop = true;
  state.tokens = state.tokens.map((token) => {
    const mark = token.type === "html_block" ? soleMark(token.content) : void 0;
    if (mark?.name !== PAGE_MARK || mark.closing) {
      atTop &&= isMarksOnly(token);
      return token;
    }
    return takePageMark(state, { token, mark, atTop });
  });
}
function takePageMark(state, page) {
  const env = state.env;
  const { token, mark, atTop } = page;
  const line = token.map?.[0];
  if (line !== void 0) {
    recordMarkNotes(env, { notes: notesOf(mark, env), line: line + 1 });
  }
  if (!atTop) {
    return warningBlock(
      state,
      withLine(
        {
          mark: mark.raw,
          message: "\u306F\u6587\u66F8\u306E\u5148\u982D\uFF08\u6700\u521D\u306E\u898B\u51FA\u3057\u30FB\u6BB5\u843D\u30FB\u8868\u30FB\u30EA\u30B9\u30C8\u30FB\u30B3\u30FC\u30C9\u30D6\u30ED\u30C3\u30AF\u3088\u308A\u524D\uFF09\u306B\u8A18\u8F09\u3057\u307E\u3059\u3002\u3053\u306E\u5834\u6240\u306E\u30DE\u30FC\u30AB\u30FC\u306F\u4F7F\u7528\u3057\u3066\u3044\u307E\u305B\u3093\u3002"
        },
        line
      )
    );
  }
  env.pageOptions ??= [];
  env.pageOptions.push({ raw: mark.raw, options: mark.options });
  const warning = markProblemWarning(mark);
  if (warning) {
    return warningBlock(state, withLine(warning, line));
  }
  token.content = "";
  return token;
}
function splitEarlyClosedMarks(state) {
  const out = [];
  for (const token of state.tokens) {
    const match = token.type === "html_block" ? /^(<!--\s*[a-z][a-z0-9-]*:\s*(\{.*?)-->)(.*\S.*)$/s.exec(
      token.content.trimEnd()
    ) : null;
    const [, mark = "", args = "", rest = ""] = match ?? [];
    if (!match || !hasUnclosedString(args)) {
      out.push(token);
      continue;
    }
    token.content = `${mark}
`;
    out.push(token);
    const open = new state.Token("paragraph_open", "p", 1);
    const inline2 = new state.Token("inline", "", 0);
    const text2 = new state.Token("text", "", 0);
    const close = new state.Token("paragraph_close", "p", -1);
    open.map = token.map;
    inline2.map = token.map;
    inline2.content = rest;
    text2.content = rest;
    inline2.children = [text2];
    out.push(open, inline2, close);
  }
  state.tokens = out;
}
function takeSyntaxMark(state, block2) {
  const env = state.env;
  const { token, line, out } = block2;
  const mark = soleSyntaxMark(token.content, env);
  if (!mark) {
    return false;
  }
  const warning = markProblemWarning(mark);
  if (warning) {
    out.push(warningBlock(state, withLine(warning, line)));
  }
  if (line !== void 0) {
    recordMarkNotes(env, { notes: notesOf(mark, env), line: line + 1 });
  }
  token.type = MARK_TOKEN;
  token.meta = mark;
  token.content = "";
  out.push(token);
  return true;
}
function replaceInlineMarks(token, context) {
  const warnings = [];
  for (const child of token.children ?? []) {
    if (child.type === "html_inline") {
      child.content = replaceMarks(child.content, context.env, {
        line: context.line,
        warnings
      });
    }
  }
  return warnings;
}
function takeMarks(state) {
  const env = state.env;
  splitEarlyClosedMarks(state);
  takeDefinitionRanges(state);
  takePageMarks(state);
  const out = [];
  for (const token of state.tokens) {
    const line = token.map?.[0];
    if (token.type === "html_block") {
      if (takeSyntaxMark(state, { token, line, out })) {
        continue;
      }
      const warnings = [];
      token.content = replaceMarks(token.content, env, { line, warnings });
      for (const warning of warnings) {
        out.push(warningBlock(state, withLine(warning, line)));
      }
    }
    for (const warning of replaceInlineMarks(token, { env, line })) {
      out.push(warningBlock(state, withLine(warning, line)));
    }
    out.push(token);
  }
  state.tokens = out;
}
function resolveDocumentFeatures(state) {
  const env = state.env;
  env.features = resolveFeatures2({
    defaults: env.defaults,
    marks: env.featureOptions
  });
}

// src/shared/tokens.syntax.ts
function envOf(state) {
  return state.env;
}
function featureOn(state, name) {
  return envOf(state).features[name] === true;
}
function ownBlock(state, html, source) {
  const token = new state.Token("html_block", "", 0);
  token.block = true;
  if (source?.map) {
    token.map = [...source.map];
  }
  token.content = markOwn(html, envOf(state).nonce);
  return token;
}
function markOf(token) {
  return token?.type === MARK_TOKEN ? token.meta : void 0;
}
function findClose(tokens, openIndex, name) {
  const level = tokens[openIndex]?.level;
  for (let index = openIndex + 1; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    if (mark?.closing && mark.name === name && token?.level === level) {
      return index;
    }
  }
  return -1;
}
function textOf(token) {
  return (token.children ?? []).filter((child) => child.type === "text" || child.type === "code_inline").map((child) => child.content).join("");
}

// src/shared/syntax-warning.syntax.ts
function plainMessage(warning) {
  const strip = (text2) => text2.replaceAll("`", "");
  return [
    `${warning.mark ?? ""}${strip(warning.message)}`,
    ...(warning.items ?? []).map(
      (item) => `${item.label ? `${item.label}: ` : ""}${strip(item.message)}`
    )
  ].join(" ");
}
function makeWarningToken(state, warning, source) {
  const { kind = "syntax_warning", includeTarget, ...view } = warning;
  delete view.line;
  const line = warning.line ?? source?.map?.[0];
  const token = ownBlock(state, renderSyntaxWarning(view));
  const meta = {
    kind,
    message: plainMessage(warning),
    ...line === void 0 ? {} : { line },
    ...includeTarget ? { includeTarget } : {}
  };
  token.meta = { ...token.meta ?? {}, warning: meta };
  return token;
}
function warningBlock(state, warning, source) {
  return makeWarningToken(state, warning, source);
}
function recordMarkNotes(env, options) {
  for (const note of options.notes) {
    env.markNotes.push({ ...note, line: options.line });
  }
}
function unclosedWarning(mark) {
  return {
    mark: mark.raw,
    message: `\u306E\u9589\u3058\u306E\u30DE\u30FC\u30AB\u30FC \`<!-- /${mark.name} -->\` \u304C\u3042\u308A\u307E\u305B\u3093\u3002\u7BC4\u56F2\u306E\u7D42\u308F\u308A\u306B\u9589\u3058\u306E\u30DE\u30FC\u30AB\u30FC\u3092\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u30DE\u30FC\u30AB\u30FC\u304B\u3089\u6587\u66F8\u306E\u7D42\u308F\u308A\u307E\u3067\u3092\u7BC4\u56F2\u306B\u3057\u3066\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`
  };
}

// src/table/csv.syntax.ts
var endRow = (reader) => {
  reader.row.push(reader.value);
  reader.rows.push(reader.row);
  reader.row = [];
  reader.value = "";
};
var readQuoted = (reader) => {
  const char = reader.text[reader.at];
  if (char === '"' && reader.text[reader.at + 1] === '"') {
    reader.value += '"';
    reader.at += 2;
    return;
  }
  if (char === '"') {
    reader.quoted = false;
  } else {
    reader.value += char;
  }
  reader.at += 1;
};
var readPlain = (reader) => {
  const char = reader.text[reader.at];
  if (char === '"') {
    reader.quoted = true;
  } else if (char === ",") {
    reader.row.push(reader.value);
    reader.value = "";
  } else if (char === "\r" && reader.text[reader.at + 1] === "\n") {
  } else if (char === "\n") {
    endRow(reader);
  } else {
    reader.value += char;
  }
  reader.at += 1;
};
var parseCsv = (text2) => {
  const reader = {
    text: text2,
    at: 0,
    rows: [],
    row: [],
    value: "",
    quoted: false
  };
  while (reader.at < text2.length) {
    if (reader.quoted) {
      readQuoted(reader);
    } else {
      readPlain(reader);
    }
  }
  if (reader.value !== "" || reader.row.length > 0) {
    endRow(reader);
  }
  return reader.rows;
};

// src/footnote/annotations.syntax.ts
var MARK = "\u203B";
var MARK_CODE = MARK.charCodeAt(0);

// src/knowledge/aliases.ts
var ALIAS_TYPES = [
  "term",
  "doc",
  "command",
  "url",
  "skill",
  "tool",
  "path",
  "env",
  "avoid"
];
var ALIAS_KEYS = [
  "id",
  "name",
  "aliases",
  "description",
  "related",
  "command",
  "cwd",
  "url",
  "avoid",
  "skill",
  "tool",
  "path",
  "port",
  "replacement"
];
var ALIAS_REQUIRED_KEYS = {
  term: ["description"],
  doc: ["description"],
  command: ["command"],
  url: ["url"],
  skill: ["skill"],
  tool: ["tool"],
  path: ["path"],
  avoid: ["replacement"],
  env: []
};
var ALIAS_KEY_LABELS = {
  id: "ID",
  name: "\u540D\u524D",
  description: "\u8AAC\u660E",
  command: "\u30B3\u30DE\u30F3\u30C9",
  url: "URL",
  skill: "\u30B9\u30AD\u30EB\u540D",
  tool: "\u30C4\u30FC\u30EB\u540D",
  path: "\u30D1\u30B9",
  replacement: "\u7F6E\u304D\u63DB\u3048\u5148"
};
var LIST_KEYS = /* @__PURE__ */ new Set(["aliases", "avoid", "related"]);
var DEFAULT_CONFIG_FILE = "mdmark.config.yaml";
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFilled(value) {
  return typeof value === "string" && value !== "";
}
function toText(value) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return void 0;
  }
  const text2 = String(value).trim();
  return text2 === "" ? void 0 : text2;
}
function toList(value) {
  if (typeof value === "string") {
    const text2 = value.trim();
    return text2 === "" ? void 0 : [text2];
  }
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter((item) => item !== "");
  }
  return void 0;
}
function readColumn(record, column) {
  let current = record;
  for (const part of column.split(".")) {
    if (!isRecord3(current) || !Object.hasOwn(current, part)) {
      return { found: false, value: void 0 };
    }
    current = current[part];
  }
  return { found: true, value: current };
}
function readAliasKey(options) {
  const { record, column, key } = options;
  if (isFilled(column)) {
    const read = readColumn(record, column);
    return read.found ? { present: true, raw: read.value } : { present: false, missing: column };
  }
  return Object.hasOwn(record, key) ? { present: true, raw: record[key] } : { present: false };
}
function toAliasValue(key, raw) {
  return LIST_KEYS.has(key) ? toList(raw) : toText(raw);
}
function nameOf(options) {
  const { record, bodyFile, fallbackName } = options;
  const bodyPath = bodyFile === void 0 ? void 0 : toText(readColumn(record, bodyFile).value);
  return bodyPath === void 0 ? fallbackName : baseName(bodyPath);
}
function readAliasRecord(options) {
  const { record, metadata, bodyFile, fallbackName } = options;
  const values = {};
  const missing = [];
  for (const key of ALIAS_KEYS) {
    const read = readAliasKey({ record, column: metadata[key], key });
    if (read.missing !== void 0) {
      missing.push({ key, field: read.missing });
    }
    const value = read.present ? toAliasValue(key, read.raw) : void 0;
    if (value !== void 0) {
      values[key] = value;
    }
  }
  if (values.name === void 0) {
    const name = nameOf({ record, bodyFile, fallbackName });
    if (name !== "") {
      values.name = name;
    }
  }
  return { values, missing };
}
function checkAliasFields(options) {
  const { aliasType, values } = options;
  const keys = [
    "id",
    "name",
    ...ALIAS_REQUIRED_KEYS[aliasType]
  ].filter((key) => !isFilled(values[key]));
  if (aliasType === "env" && !isFilled(values.url) && !isFilled(values.port)) {
    keys.push("url");
  }
  return keys.length === 0 ? void 0 : { kind: "alias_required_empty", keys };
}
function usableType(item, seen) {
  const type = ALIAS_TYPES.find((candidate) => candidate === item.alias_type);
  if (type === void 0 || type === "env") {
    return void 0;
  }
  if (!isFilled(item.id) || !isFilled(item.name) || seen.has(item.id)) {
    return void 0;
  }
  return ALIAS_REQUIRED_KEYS[type].every((key) => isFilled(item[key])) ? type : void 0;
}
function toUsableAlias(item, type) {
  const list2 = (value) => Array.isArray(value) ? value.filter(isFilled) : [];
  const alias = {
    alias_type: type,
    id: item.id,
    name: item.name,
    aliases: list2(item.aliases),
    avoid: list2(item.avoid)
  };
  for (const key of [
    "description",
    "command",
    "cwd",
    "url",
    "skill",
    "tool",
    "path",
    "replacement"
  ]) {
    const value = item[key];
    if (typeof value === "string") {
      alias[key] = value;
    }
  }
  if (Array.isArray(item.related)) {
    alias.related = list2(item.related);
  }
  if (typeof item.row === "string") {
    alias.row = item.row;
  }
  const details = Array.isArray(item.details) ? item.details.filter(isDetail) : [];
  if (details.length > 0) {
    alias.details = details;
  }
  return alias;
}
function isDetail(value) {
  return isRecord3(value) && isFilled(value.title) && isFilled(value.href);
}
var SCHEME = /^[a-z][a-z0-9+.-]*:/i;
function normalizePath(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === ".." && parts.length > 0 && parts.at(-1) !== "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}
function readAliasDetails(options) {
  const { value, sourcePath } = options;
  if (!Array.isArray(value)) {
    return void 0;
  }
  const folder = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
  const details = value.filter(isDetail).map(({ title, href }) => {
    if (SCHEME.test(href) || href.startsWith("#")) {
      return { title, href };
    }
    const hash = href.indexOf("#");
    const path = hash === -1 ? href : href.slice(0, hash);
    const anchor = hash === -1 ? "" : href.slice(hash);
    const joined = folder === "" ? path : `${folder}/${path}`;
    return { title, href: `${normalizePath(joined)}${anchor}` };
  });
  return details.length > 0 ? details : void 0;
}
function usableAliases(aliases) {
  const seen = /* @__PURE__ */ new Set();
  const usable = [];
  for (const item of aliases) {
    const type = isRecord3(item) ? usableType(item, seen) : void 0;
    if (!isRecord3(item) || type === void 0) {
      continue;
    }
    const row = item;
    seen.add(row.id);
    usable.push(toUsableAlias(row, type));
  }
  return usable;
}
function toAlias(values, aliasType, extra) {
  const text2 = (key) => typeof values[key] === "string" ? values[key] : void 0;
  const list2 = (key) => Array.isArray(values[key]) ? values[key] : void 0;
  const alias = {
    alias_type: aliasType,
    id: values.id,
    name: values.name,
    aliases: list2("aliases") ?? []
  };
  for (const key of [
    "description",
    "command",
    "cwd",
    "url",
    "skill",
    "tool",
    "path",
    "replacement"
  ]) {
    const value = text2(key);
    if (value !== void 0) {
      alias[key] = value;
    }
  }
  const related = list2("related");
  if (related !== void 0) {
    alias.related = related;
  }
  const avoid = list2("avoid");
  if (avoid !== void 0) {
    alias.avoid = avoid;
  }
  alias.row = extra.row;
  if (extra.details !== void 0) {
    alias.details = extra.details;
  }
  return alias;
}
function baseName(path) {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
function joinWhere(recordPath, key) {
  return recordPath === "" ? key : `${recordPath}.${key}`;
}
function columnOf(row, key) {
  const column = row.metadata[key];
  return isFilled(column) ? column : key;
}
function isEnabledRow(row) {
  return isRecord3(row) && isFilled(row.id) && Array.isArray(row.paths) && typeof row.alias_type === "string" && row.enabled !== false;
}
function acceptRow(build, row, rowPosition) {
  if (!isEnabledRow(row)) {
    return void 0;
  }
  if (build.rowIds.has(row.id)) {
    build.problems.push({
      file: build.configFile,
      where: `aliases[${rowPosition}].id`,
      kind: "duplicate_alias_row_id",
      message: `\u884C\u306E \`id\` \`${row.id}\` \u304C\u524D\u306E\u884C\u3068\u540C\u3058\u3067\u3059\u3002\`id\` \u3092\u5909\u3048\u3066\u304F\u3060\u3055\u3044\u3002`
    });
    return void 0;
  }
  build.rowIds.add(row.id);
  const aliasType = ALIAS_TYPES.find(
    (candidate) => candidate === row.alias_type
  );
  if (aliasType === void 0) {
    build.problems.push({
      file: build.configFile,
      where: `aliases[${rowPosition}].alias_type`,
      kind: "alias_unknown_type",
      message: `\`alias_type\` \u306E \`${row.alias_type}\` \u306F\u7A2E\u985E\u306B\u3042\u308A\u307E\u305B\u3093\u3002\`term\`\u30FB\`doc\`\u30FB\`command\`\u30FB\`url\`\u30FB\`skill\`\u30FB\`tool\`\u30FB\`path\`\u30FB\`env\`\u30FB\`avoid\` \u306E\u3069\u308C\u304B\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    });
    return void 0;
  }
  return {
    id: row.id,
    aliasType,
    metadata: isRecord3(row.metadata) ? row.metadata : {},
    recordsKey: isFilled(row.records) ? row.records : void 0,
    bodyFile: isFilled(row.body_file) ? row.body_file : void 0
  };
}
function recordsOf(build, row, source) {
  const { recordsKey } = row;
  if (recordsKey === void 0) {
    return [{ record: source.data, path: "" }];
  }
  const list2 = isRecord3(source.data) ? source.data[recordsKey] : void 0;
  if (!Array.isArray(list2)) {
    build.problems.push({
      file: source.path,
      where: "",
      kind: "alias_records_missing",
      message: `\`${recordsKey}\` \u306E\u914D\u5217\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u30D5\u30A1\u30A4\u30EB\u306B \`${recordsKey}\` \u306E\u914D\u5217\u3092\u8A18\u8F09\u3059\u308B\u304B\u3001\`records\` \u3092\u4FEE\u6B63\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    });
    return void 0;
  }
  return list2.map((record, position) => ({
    record,
    path: `${recordsKey}[${position}]`
  }));
}
function pushRequiredProblems(build, row, at) {
  const { source, path, keys } = at;
  const head = path === "" ? `\`${source.path}\`` : `\`${source.path}\` \u306E \`${path}\``;
  for (const key of keys) {
    const column = columnOf(row, key);
    const sentence = key === "url" && row.aliasType === "env" ? `${head} \u306E \`url\` \u3068 \`port\` \u304C\u4E21\u65B9\u7A7A\u3067\u3059\u3002URL \u304B\u30DD\u30FC\u30C8\u3092\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002` : `${head} \u306E \`${column}\` \u304C\u7A7A\u3067\u3059\u3002${ALIAS_KEY_LABELS[key] ?? key}\u3092\u8A18\u8F09\u3057\u3066\u304F\u3060\u3055\u3044\u3002`;
    build.problems.push({
      file: source.path,
      where: joinWhere(path, column),
      kind: "alias_required_empty",
      message: sentence
    });
  }
}
function takeRecord(build, row, at) {
  const { source, record, path } = at;
  const fallbackName = row.recordsKey === void 0 ? baseName(source.path) : toText(record.id) ?? "";
  const { values, missing } = readAliasRecord({
    record,
    metadata: row.metadata,
    bodyFile: row.bodyFile,
    fallbackName
  });
  for (const { key, field } of missing) {
    build.problems.push({
      file: source.path,
      where: joinWhere(path, field),
      kind: "alias_field_missing",
      message: `\`metadata.${key}\` \u304C\u6307\u3059\u5217 \`${field}\` \u304C\u30EC\u30B3\u30FC\u30C9\u306B\u3042\u308A\u307E\u305B\u3093\u3002\u5217\u3092\u8A18\u8F09\u3059\u308B\u304B\u3001\`metadata.${key}\` \u3092\u4FEE\u6B63\u3057\u3066\u304F\u3060\u3055\u3044\u3002`
    });
  }
  if (missing.length > 0) {
    return;
  }
  const checked = checkAliasFields({ aliasType: row.aliasType, values });
  if (checked !== void 0) {
    pushRequiredProblems(build, row, { source, path, keys: checked.keys });
    return;
  }
  const id = values.id;
  if (build.aliasIds.has(id)) {
    build.problems.push({
      file: source.path,
      where: joinWhere(path, columnOf(row, "id")),
      kind: "duplicate_alias_id",
      message: `\u30A8\u30A4\u30EA\u30A2\u30B9\u306E \`id\` \`${id}\` \u304C\u524D\u306E\u30A8\u30A4\u30EA\u30A2\u30B9\u3068\u540C\u3058\u3067\u3059\u3002\`id\` \u3092\u5909\u3048\u3066\u304F\u3060\u3055\u3044\u3002`
    });
    return;
  }
  build.aliasIds.add(id);
  if (row.aliasType !== "env") {
    const details = readAliasDetails({
      value: readColumn(record, columnOf(row, "details")).value,
      sourcePath: source.path
    });
    build.aliases.push(
      toAlias(values, row.aliasType, { row: row.id, details })
    );
  }
}
function buildAliases(input) {
  const { rows, sources, configFile = DEFAULT_CONFIG_FILE } = input;
  const build = {
    aliases: [],
    problems: [],
    rowIds: /* @__PURE__ */ new Set(),
    aliasIds: /* @__PURE__ */ new Set(),
    configFile
  };
  rows.forEach((item, rowPosition) => {
    const row = acceptRow(build, item, rowPosition);
    if (!row) {
      return;
    }
    for (const source of sources.filter((entry) => entry.rowId === row.id)) {
      for (const { record, path } of recordsOf(build, row, source) ?? []) {
        if (isRecord3(record)) {
          takeRecord(build, row, { source, record, path });
        }
      }
    }
  });
  return { aliases: build.aliases, problems: build.problems };
}

// src/knowledge/dictionary.ts
var segmenter;
var FALLBACK_WORD = /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+|[\s\S]/gu;
function normalizeWord(word) {
  return word.normalize("NFKC").toLowerCase().trim();
}
function addTerm(maps, words, value) {
  const { id, meaning, alias } = value;
  for (const word of words) {
    const key = normalizeWord(word);
    if (key === "") {
      continue;
    }
    if (alias === void 0 && !maps.plainTerms.has(key)) {
      maps.plainTerms.set(key, { id, meaning });
    }
    if (!maps.terms.has(key)) {
      maps.terms.set(key, value);
      maps.written.set(key, word);
    }
  }
}
function addAvoided(maps, words, value) {
  for (const word of words) {
    const key = normalizeWord(word);
    if (key !== "" && !maps.terms.has(key) && !maps.avoided.has(key)) {
      maps.avoided.set(key, value);
      maps.written.set(key, word);
    }
  }
}
var glossaryId = (entry) => `glossary:${entry.docId}:${entry.term}`;
function docOrder(index) {
  return (id) => {
    const position = index?.docs.findIndex((doc) => doc.id === id) ?? -1;
    return position === -1 ? Number.MAX_SAFE_INTEGER : position;
  };
}
function addAllTerms(maps, sources) {
  const { index, usable, ownGlossary, others } = sources;
  for (const term of index?.terms ?? []) {
    addTerm(maps, [term.term, ...term.aliases ?? []], {
      id: term.id,
      meaning: term.meaning
    });
  }
  for (const alias of usable) {
    if (alias.alias_type !== "avoid") {
      addTerm(maps, [alias.name, ...alias.aliases], {
        id: `alias:${alias.id}`,
        meaning: alias.description ?? "",
        alias
      });
    }
  }
  for (const entry of [...ownGlossary, ...others]) {
    addTerm(maps, [entry.term, ...entry.aliases], {
      id: glossaryId(entry),
      meaning: entry.meaning
    });
  }
}
function addAliasAvoided(maps, usable) {
  for (const alias of usable) {
    if (alias.alias_type === "avoid") {
      addAvoided(maps, [alias.name, ...alias.aliases], {
        id: `alias:${alias.id}`,
        term: alias.replacement ?? "",
        alias
      });
    } else if (alias.alias_type === "term") {
      addAvoided(maps, alias.avoid ?? [], {
        id: `alias:${alias.id}`,
        term: alias.name,
        meaning: alias.description ?? "",
        alias
      });
    }
  }
}
function addAllAvoided(maps, sources) {
  const { index, usable, tables } = sources;
  for (const term of index?.terms ?? []) {
    addAvoided(maps, term.avoid ?? [], {
      id: term.id,
      term: term.term,
      meaning: term.meaning
    });
  }
  addAliasAvoided(maps, usable);
  const sorted = [...tables].sort((a, b) => a.position - b.position);
  for (const { entry } of sorted) {
    addAvoided(maps, entry.avoid ?? [], {
      id: glossaryId(entry),
      term: entry.term,
      meaning: entry.meaning
    });
  }
}
function addDocAliases(maps, index, docId) {
  for (const doc of index?.docs ?? []) {
    if (doc.id === docId) {
      continue;
    }
    for (const alias of doc.aliases ?? []) {
      const key = normalizeWord(alias);
      if (key === "") {
        continue;
      }
      maps.docs.set(key, [...maps.docs.get(key) ?? [], doc]);
      if (!maps.written.has(key)) {
        maps.written.set(key, alias);
      }
    }
  }
}
function addGlossary(maps, sources) {
  const { index, docId, ownGlossary, references, usable } = sources;
  const order = docOrder(index);
  const others = (references?.glossary ?? []).filter((entry) => docId === void 0 || entry.docId !== docId).sort((a, b) => order(a.docId) - order(b.docId));
  addAllTerms(maps, { index, usable, ownGlossary, others });
  const ownPosition = docId !== void 0 && order(docId) !== Number.MAX_SAFE_INTEGER ? order(docId) : -1;
  addAllAvoided(maps, {
    index,
    usable,
    tables: [
      ...ownGlossary.map((entry) => ({ entry, position: ownPosition })),
      ...others.map((entry) => ({ entry, position: order(entry.docId) }))
    ]
  });
}
function buildDictionary(options) {
  const { index, docId, ownGlossary, references, features } = options;
  const usable = usableAliases(options.aliases ?? []);
  const maps = {
    terms: /* @__PURE__ */ new Map(),
    plainTerms: /* @__PURE__ */ new Map(),
    docs: /* @__PURE__ */ new Map(),
    avoided: /* @__PURE__ */ new Map(),
    written: /* @__PURE__ */ new Map()
  };
  if (features.glossary !== false) {
    addGlossary(maps, { index, docId, ownGlossary, references, usable });
  }
  if (features.backlinks !== false) {
    addDocAliases(maps, index, docId);
  }
  const words = [.../* @__PURE__ */ new Set([...maps.terms.keys(), ...maps.docs.keys()])].sort(
    (a, b) => b.length - a.length
  );
  const { terms, docs, avoided, written, plainTerms } = maps;
  return {
    words,
    terms,
    docs,
    avoided,
    written,
    term: (word) => plainTerms.get(normalizeWord(word))
  };
}
function wordStarts(text2) {
  if (typeof Intl.Segmenter !== "undefined") {
    segmenter ??= new Intl.Segmenter("ja", { granularity: "word" });
    return [...segmenter.segment(text2)].map((segment) => segment.index);
  }
  return [...text2.matchAll(FALLBACK_WORD)].map((match) => match.index);
}
function findWords(text2, words) {
  const passed = /* @__PURE__ */ new Map();
  for (const word of words) {
    const key = normalizeWord(word);
    if (key !== "" && !passed.has(key)) {
      passed.set(key, word);
    }
  }
  const longestFirst = [...passed.keys()].sort((a, b) => b.length - a.length);
  const starts = wordStarts(text2);
  const folded = starts.map(
    (start, position) => text2.slice(start, starts[position + 1] ?? text2.length).normalize("NFKC").toLowerCase()
  );
  const normalized = folded.join("");
  const originals = /* @__PURE__ */ new Map([[normalized.length, text2.length]]);
  const heads = [];
  let head = 0;
  starts.forEach((start, position) => {
    heads.push(head);
    originals.set(head, start);
    head += folded[position].length;
  });
  const found = [];
  let skipTo = 0;
  starts.forEach((start, position) => {
    if (start < skipTo) {
      return;
    }
    const from = heads[position];
    const key = longestFirst.find(
      (candidate) => normalized.startsWith(candidate, from) && originals.has(from + candidate.length)
    );
    if (key !== void 0) {
      const end = originals.get(from + key.length);
      found.push({ start, end, word: passed.get(key) });
      skipTo = end;
    }
  });
  return found;
}
function forEachInline(tokens, callback) {
  let section = 0;
  let inHeading = false;
  for (const token of tokens) {
    if (token.type === "heading_open") {
      inHeading = true;
      if (/^h[234]$/.test(token.tag)) {
        section += 1;
      }
    } else if (token.type === "heading_close") {
      inHeading = false;
    } else if (token.type === "inline" && !inHeading) {
      callback(token, section);
    }
  }
}
function matchableChildren(inline2) {
  const positions = [];
  let linkDepth = 0;
  (inline2.children ?? []).forEach((child, position) => {
    if (child.type === "link_open") {
      linkDepth += 1;
    } else if (child.type === "link_close") {
      linkDepth -= 1;
    } else if (child.type === "text" && linkDepth === 0 && child.meta?.mdmarkNoTerms !== true) {
      positions.push(position);
    }
  });
  return positions;
}

// src/tree/tree.part.ts
var EXTENSIONS_BY_ICON = {
  "file-text": ["md", "mdx", "txt", "rst"],
  "file-code": [
    "ts",
    "tsx",
    "mts",
    "cts",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "c",
    "h",
    "cpp",
    "cs",
    "php",
    "css",
    "scss",
    "html",
    "vue",
    "svelte"
  ],
  "file-json": [
    "json",
    "jsonc",
    "yaml",
    "yml",
    "toml",
    "xml",
    "ini",
    "env",
    "lock"
  ],
  "file-image": ["png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico"],
  "file-spreadsheet": ["csv", "tsv", "xlsx"],
  "file-archive": ["zip", "gz", "tgz", "tar", "vsix"],
  "file-terminal": ["sh", "bash", "zsh", "ps1", "bat"]
};
var ICON_BY_EXTENSION = new Map(
  Object.entries(EXTENSIONS_BY_ICON).flatMap(
    ([icon, extensions2]) => extensions2.map((extension) => [
      extension,
      icon
    ])
  )
);

// src/tree/tree.syntax.ts
var TREE_LINE_PATTERN = /^[\t \u00A0│|]*(?:├── |└── |\|-- |`-- )/u;
var PLAIN_TREE_MIN_LINES = 2;
var PLAIN_TREE_EXCLUDED_LANGUAGES = [
  "mermaid",
  "csv"
];
var countTreeLines = (source) => source.split("\n").filter((line) => TREE_LINE_PATTERN.test(line)).length;
var INDENT_UNITS = ["\u2502   ", "|   ", "    "];
var CONNECTORS = ["\u251C\u2500\u2500 ", "\u2514\u2500\u2500 ", "|-- ", "`-- "];
var RULE_WIDTH = 4;
var NOTE_SEPARATOR = /\s#/;
function readLine(line) {
  let depth = 0;
  let position = 0;
  while (INDENT_UNITS.some((unit) => line.startsWith(unit, position))) {
    position += RULE_WIDTH;
    depth += 1;
  }
  if (CONNECTORS.some((connector) => line.startsWith(connector, position))) {
    position += RULE_WIDTH;
    depth += 1;
  }
  return { depth, text: line.slice(position) };
}
function splitNote(text2, renderNote) {
  const separator = NOTE_SEPARATOR.exec(text2);
  if (!separator) {
    return { name: text2.trim() };
  }
  const name = text2.slice(0, separator.index).trim();
  const note = text2.slice(separator.index + separator[0].length).trim();
  return note === "" ? { name } : { name, note: renderNote(note) };
}
function parseTree(source, renderNote = escapeHtml2) {
  const nodes = [];
  const stack = [];
  const lines = source.split("\n").filter((line) => line.trim() !== "");
  let previous = -1;
  for (const [index, line] of lines.entries()) {
    const { depth, text: text2 } = readLine(line);
    if (depth > previous + 1) {
      return { line: index + 1, depth: depth - previous };
    }
    const node = splitNote(text2, renderNote);
    stack.length = depth;
    const parent = stack[depth - 1];
    if (parent) {
      parent.children = [...parent.children ?? [], node];
    } else {
      nodes.push(node);
    }
    stack[depth] = node;
    previous = depth;
  }
  return { nodes };
}

// src/mdmark-style/blocks.ts
var CALLOUT_TYPES = [
  "NOTE",
  "TIP",
  "IMPORTANT",
  "WARNING",
  "CAUTION"
];
var STACK_MARKERS = [
  "tabs",
  "columns",
  "cards",
  "wide",
  "view"
];
var MD = new MarkdownItCallable({ html: true });
var MARKER_LINE = /^<!--\s*(\/?[\w-]+)\s*(?::\s*([\s\S]*?))?\s*-->$/;
var INLINE_MARKER = /[ \t]*<!--.*?-->[ \t]*/g;
var CALLOUT_HEAD = /^\s*>\s*\[!(\w+)\]([-+]?)\s*(.*)$/;
var CODE_MARK = /\s*(?:\/\/|#|--|;|<!--|\/\*)?\s*\[!code (\+\+|--|highlight|focus|error|warning)\]\s*(?:-->|\*\/)?\s*$/;
var stripInlineMarkers = (line) => line.replace(
  INLINE_MARKER,
  (_match, offset) => offset === 0 ? "" : " "
).trimEnd();
var stripWithColumns = (line, shift) => {
  let text2 = "";
  const columns = [];
  let from = 0;
  const keep = (end2) => {
    for (let at = from; at < end2; at += 1) {
      text2 += line[at];
      columns.push(at + shift);
    }
  };
  for (const match of line.matchAll(INLINE_MARKER)) {
    keep(match.index);
    if (match.index !== 0) {
      text2 += " ";
      columns.push(match.index + shift);
    }
    from = match.index + match[0].length;
  }
  keep(line.length);
  const end = text2.trimEnd().length;
  return { text: text2.slice(0, end), columns: columns.slice(0, end) };
};
var readMarker = (text2) => {
  const match = MARKER_LINE.exec(text2.trim());
  return match?.[1] === void 0 ? void 0 : { name: match[1], args: (match[2] ?? "").trim() };
};
var chunksOf = (tokens) => {
  const chunks = [];
  let current = [];
  let depth = 0;
  for (const token of tokens) {
    current.push(token);
    depth += token.nesting;
    if (depth === 0) {
      const first = current[0];
      const map3 = first?.map ?? current.find((item) => item.map)?.map;
      chunks.push({
        tokens: current,
        start: map3?.[0] ?? 0,
        end: map3?.[1] ?? 0
      });
      current = [];
    }
  }
  return chunks;
};
var push = (state, block2) => {
  const frame = state.frames.at(-1);
  (frame === void 0 ? state.out : frame.body).push(block2);
};
var currentList = (state) => state.frames.at(-1)?.body ?? state.out;
var closeRowDetail = (state, frame) => {
  const table2 = frame.table?.table;
  const at = frame.at;
  if (table2 !== void 0 && at !== void 0 && Number.isInteger(at) && at >= 1 && at <= table2.rows.length) {
    table2.details = [
      ...table2.details ?? [],
      { row: at - 1, body: frame.body }
    ];
    return;
  }
  for (const block2 of frame.body) {
    push(state, block2);
  }
};
var tabSections = (body) => {
  const level = body.find((block2) => block2.kind === "heading")?.heading?.level;
  const sections = [{ body: [] }];
  for (const block2 of body) {
    if (block2.heading !== void 0 && block2.heading.level === level) {
      sections.push({ title: block2.heading.text, body: [] });
    } else {
      sections.at(-1)?.body.push(block2);
    }
  }
  return sections.filter(
    (section) => section.title !== void 0 || section.body.length > 0
  );
};
var columnSections = (body, cuts) => [0, ...cuts].map((from, index) => ({
  body: body.slice(from, cuts[index] ?? body.length)
}));
var cardLine = (item) => {
  const text2 = item.replace(/`icon:[^`]*`\s*/g, "").trim();
  const link2 = /\[([^\]]*)\]\([^)]*\)/.exec(text2);
  if (link2 === null) {
    return text2;
  }
  const description = `${text2.slice(0, link2.index)} ${text2.slice(link2.index + link2[0].length)}`.replace(/\s+/g, " ").trim();
  const title = link2[1] ?? "";
  return description === "" ? title : `${title} \u2014 ${description}`;
};
var cardBlock = (block2) => {
  if (block2.kind !== "markdown" || block2.markdown === void 0) {
    return block2;
  }
  const items = [];
  for (const line of block2.markdown.split("\n")) {
    const head = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (head !== null) {
      items.push(head[1] ?? "");
    } else if (items.length > 0) {
      items[items.length - 1] = `${items.at(-1)} ${line.trim()}`;
    }
  }
  if (items.length === 0) {
    return block2;
  }
  return {
    kind: "markdown",
    line: block2.line,
    markdown: items.map((item) => `- ${cardLine(item)}`).join("\n")
  };
};
var closeStack = (state, frame) => {
  const kind = frame.stack ?? "wide";
  const sections = kind === "tabs" ? tabSections(frame.body) : kind === "columns" ? columnSections(frame.body, frame.cuts ?? []) : [{ body: kind === "cards" ? frame.body.map(cardBlock) : frame.body }];
  push(state, {
    kind: "stack",
    line: frame.body[0]?.line ?? 0,
    stack: { kind, sections }
  });
};
var closeFrame = (state) => {
  const frame = state.frames.pop();
  if (frame === void 0) {
    return;
  }
  if (frame.kind === "row-detail") {
    closeRowDetail(state, frame);
    return;
  }
  if (frame.kind === "stack") {
    closeStack(state, frame);
    return;
  }
  push(state, {
    kind: "fold",
    line: frame.line,
    fold: { title: frame.title, index: frame.index, body: frame.body }
  });
};
var lineOf = (state, chunk) => state.lineBase + chunk.start + 1;
var rawOf = (state, chunk) => {
  const lines = state.lines.slice(chunk.start, chunk.end).map(
    (line2, offset) => stripWithColumns(line2, state.prefixes[chunk.start + offset] ?? 0)
  );
  let line = lineOf(state, chunk);
  while (lines[0] !== void 0 && lines[0].text.trim() === "") {
    lines.shift();
    line += 1;
  }
  while (lines.at(-1) !== void 0 && lines.at(-1)?.text.trim() === "") {
    lines.pop();
  }
  const first = lines[0];
  if (first !== void 0) {
    const lead = first.text.length - first.text.trimStart().length;
    lines[0] = {
      text: first.text.slice(lead),
      columns: first.columns.slice(lead)
    };
  }
  return { line, lines };
};
var pushMarkdown = (state, chunk) => {
  const { line, lines } = rawOf(state, chunk);
  if (lines.length === 0) {
    return;
  }
  push(state, {
    kind: "markdown",
    line,
    markdown: lines.map((item) => item.text).join("\n"),
    columns: lines.map((item) => item.columns)
  });
};
var tableKindOf = (args) => {
  try {
    const kind = JSON.parse(args)?.kind;
    return kind === "data" || kind === "plain" ? kind : "default";
  } catch {
    return "default";
  }
};
var highlightLines = (value) => {
  const lines = /* @__PURE__ */ new Set();
  for (const part of value.split(",")) {
    const [from, to] = part.split("-").map((item) => Number(item.trim()));
    if (from === void 0 || !Number.isInteger(from)) {
      continue;
    }
    const last = to !== void 0 && Number.isInteger(to) ? to : from;
    for (let line = from; line <= last; line += 1) {
      lines.add(line);
    }
  }
  return lines;
};
var codeOptionsOf = (args) => {
  const options = {
    lineNumbers: false,
    highlight: /* @__PURE__ */ new Set()
  };
  for (const match of args.matchAll(/(\w+)(?:=("[^"]*"|\S+))?/g)) {
    const [, key, raw] = match;
    const value = raw?.replace(/^"|"$/g, "");
    if (key === "title" && value !== void 0) {
      options.title = value;
    } else if (key === "lines") {
      options.lineNumbers = true;
    } else if (key === "highlight" && value !== void 0) {
      options.highlight = highlightLines(value);
    }
  }
  if (argOf(args, "tree_warning") === false) options.plainTree = false;
  return options;
};
var argOf = (args, key) => {
  try {
    const value = JSON.parse(args);
    return typeof value === "object" && value !== null ? value[key] : void 0;
  } catch {
    return void 0;
  }
};
var openFrame = (state, frame) => state.frames.push({
  title: "",
  level: 0,
  index: -1,
  line: 0,
  body: [],
  ...frame
});
var closeIfTop = (kind, stack) => (state) => {
  const top = state.frames.at(-1);
  if (top?.kind === kind && (stack === void 0 || top.stack === stack)) {
    closeFrame(state);
  }
};
var stackHandlers = STACK_MARKERS.flatMap(
  (name) => [
    [
      name,
      (state) => {
        if (state.parts.stack) {
          openFrame(state, { kind: "stack", stack: name, cuts: [] });
        }
      }
    ],
    [`/${name}`, closeIfTop("stack", name)]
  ]
);
var MARKER_HANDLERS = new Map([
  [
    "table",
    (state, marker) => {
      state.pendingTable = tableKindOf(marker.args);
    }
  ],
  [
    "code",
    (state, marker) => {
      state.pendingCode = codeOptionsOf(marker.args);
    }
  ],
  [
    "details",
    (state, marker) => {
      if (state.parts.fold) {
        openFrame(state, {
          kind: "details",
          title: marker.args,
          index: state.foldCount.value++
        });
      }
    }
  ],
  ["/details", closeIfTop("details")],
  [
    "section",
    (state, marker) => {
      if (state.parts.fold) {
        openSection(state, marker.args);
      }
    }
  ],
  [
    "fig",
    (state, marker) => {
      if (state.parts.figure) {
        const id = argOf(marker.args, "id");
        state.pendingFigure = typeof id === "string" ? id : "";
      }
    }
  ],
  [
    "row-detail",
    (state, marker) => {
      const last = currentList(state).at(-1);
      const at = argOf(marker.args, "at");
      openFrame(state, {
        kind: "row-detail",
        ...typeof at === "number" ? { at } : {},
        ...state.parts.row_detail && last?.kind === "table" ? { table: last } : {}
      });
    }
  ],
  ["/row-detail", closeIfTop("row-detail")],
  [
    "steps",
    (state) => {
      state.inSteps = state.parts.steps;
    }
  ],
  [
    "/steps",
    (state) => {
      state.inSteps = false;
    }
  ],
  [
    "column",
    (state) => {
      const top = state.frames.at(-1);
      if (top?.stack === "columns") {
        top.cuts?.push(top.body.length);
      }
    }
  ],
  ...stackHandlers
]);
var applyMarker = (state, marker) => {
  MARKER_HANDLERS.get(marker.name)?.(state, marker);
};
var openSection = (state, args) => {
  const closed = args === "closed" || /"open"\s*:\s*false/.test(args);
  const list2 = currentList(state);
  const heading2 = list2.at(-1);
  if (!closed || heading2?.kind !== "heading" || heading2.heading === void 0) {
    return;
  }
  list2.pop();
  state.frames.push({
    kind: "section",
    title: heading2.heading.text,
    level: heading2.heading.level,
    index: state.foldCount.value++,
    line: heading2.line,
    body: []
  });
};
var closeSections = (state, level) => {
  while (true) {
    const frame = state.frames.at(-1);
    if (frame?.kind !== "section" || frame.level < level) {
      return;
    }
    closeFrame(state);
  }
};
var handleHtml = (state, chunk) => {
  const text2 = chunk.tokens[0]?.content ?? "";
  const lines = text2.split("\n").filter((line) => line.trim() !== "");
  const markers = lines.map(readMarker);
  if (markers.every((marker) => marker !== void 0)) {
    for (const marker of markers) {
      applyMarker(state, marker);
    }
    return;
  }
  pushMarkdown(state, chunk);
};
var handleHeading = (state, chunk) => {
  const level = Number(chunk.tokens[0]?.tag.slice(1));
  closeSections(state, level);
  if (!state.parts.heading) {
    pushMarkdown(state, chunk);
    return;
  }
  const text2 = stripInlineMarkers(chunk.tokens[1]?.content ?? "").trim();
  push(state, {
    kind: "heading",
    line: lineOf(state, chunk),
    heading: { level, text: text2 }
  });
};
var alignOf = (token) => {
  const style = String(token.attrGet("style") ?? "");
  if (style.includes("center")) {
    return "center";
  }
  return style.includes("right") ? "right" : "left";
};
var readTable = (tokens) => {
  const rows = [];
  const align = [];
  for (const [index, token] of tokens.entries()) {
    if (token.type === "tr_open") {
      rows.push([]);
    } else if (token.type === "th_open" || token.type === "td_open") {
      const cell = stripInlineMarkers(tokens[index + 1]?.content ?? "").trim();
      rows.at(-1)?.push(cell);
    }
    if (token.type === "th_open") {
      align.push(alignOf(token));
    }
  }
  return { rows, align };
};
var handleTable = (state, chunk) => {
  const kind = state.pendingTable ?? "default";
  state.pendingTable = void 0;
  if (!state.parts.table) {
    pushMarkdown(state, chunk);
    return;
  }
  const { rows, align } = readTable(chunk.tokens);
  const [header = [], ...body] = rows;
  const id = state.pendingFigure;
  state.pendingFigure = void 0;
  let figure;
  if (id !== void 0) {
    state.figures.count += 1;
    figure = state.figures.count;
    if (id !== "") {
      state.figures.ids.set(id, figure);
    }
  }
  push(state, {
    kind: "table",
    line: lineOf(state, chunk),
    table: {
      kind,
      header,
      rows: body,
      align,
      ...figure === void 0 ? {} : { figure }
    }
  });
};
var TREE_INDENTS = ["\u2502   ", "|   ", "    "];
var TREE_CONNECTORS = ["\u251C\u2500\u2500 ", "\u2514\u2500\u2500 ", "|-- ", "`-- "];
var hasBareIndent = (source) => source.split("\n").filter((line) => line.trim() !== "").some((line) => {
  let at = 0;
  while (TREE_INDENTS.some((unit) => line.startsWith(unit, at))) {
    at += 4;
  }
  return at > 0 && !TREE_CONNECTORS.some((connector) => line.startsWith(connector, at));
});
var treeLines = (nodes, prefix, depth) => nodes.flatMap((node, index) => {
  const last = index === nodes.length - 1;
  const rule = depth === 0 ? "" : `${prefix}${last ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 "}`;
  const childPrefix = depth === 0 ? "" : `${prefix}${last ? "    " : "\u2502   "}`;
  return [
    {
      rule,
      name: node.name,
      ...node.note === void 0 ? {} : { note: node.note }
    },
    ...treeLines(node.children ?? [], childPrefix, depth + 1)
  ];
});
var treeBlockOf = (source, line) => {
  if (hasBareIndent(source)) {
    return void 0;
  }
  const result = parseTree(source, (note) => note);
  if (!("nodes" in result)) {
    return void 0;
  }
  return {
    kind: "tree",
    line,
    tree: { lines: treeLines(result.nodes, "", 0) }
  };
};
var csvBlockOf = (source, line) => {
  const [header = [], ...rows] = parseCsv(source);
  return {
    kind: "table",
    line,
    table: {
      kind: "default",
      header,
      rows,
      align: header.map(() => "left")
    }
  };
};
var partBlockOf = (options) => {
  const { parts, lang, source, line } = options;
  if (lang === "tree" && parts.tree) {
    return treeBlockOf(source, line);
  }
  const tree = isPlainTree(options) ? treeBlockOf(source, line) : void 0;
  if (tree) return tree;
  return lang === "csv" && parts.stack ? csvBlockOf(source, line) : void 0;
};
var isPlainTree = (options) => options.plainTree && options.parts.tree && options.parts.code && !PLAIN_TREE_EXCLUDED_LANGUAGES.includes(options.lang) && countTreeLines(options.source) >= PLAIN_TREE_MIN_LINES;
var handleFence = (state, chunk) => {
  const options = state.pendingCode ?? {
    lineNumbers: false,
    highlight: /* @__PURE__ */ new Set()
  };
  state.pendingCode = void 0;
  const token = chunk.tokens[0];
  const lang = (token?.info ?? "").trim().split(/\s+/)[0] ?? "";
  const source = (token?.content ?? "").replace(/\n$/, "");
  const part = partBlockOf({
    parts: state.parts,
    lang,
    source,
    line: lineOf(state, chunk),
    plainTree: options.plainTree !== false
  });
  if (part !== void 0) {
    push(state, part);
    return;
  }
  if (!state.parts.code) {
    pushMarkdown(state, chunk);
    return;
  }
  const lines = source.split("\n").map((text2, index) => {
    const match = CODE_MARK.exec(text2);
    const mark = match?.[1];
    const line = { text: match === null ? text2 : text2.slice(0, match.index) };
    if (mark !== void 0) {
      return { ...line, mark };
    }
    return options.highlight.has(index + 1) ? { ...line, mark: "highlight" } : line;
  });
  push(state, {
    kind: "code",
    line: lineOf(state, chunk),
    code: {
      lang,
      ...options.title === void 0 ? {} : { title: options.title },
      lineNumbers: options.lineNumbers,
      lines
    }
  });
};
var calloutHeadOf = (line, parts) => {
  const [, rawType = "", sign = "", rawTitle = ""] = CALLOUT_HEAD.exec(line) ?? [];
  const type = rawType.toUpperCase();
  if (!parts.callout || !CALLOUT_TYPES.includes(type)) {
    return void 0;
  }
  return { type, closed: sign === "-" && parts.fold, title: rawTitle.trim() };
};
var handleQuote = (state, chunk) => {
  const lines = state.lines.slice(chunk.start, chunk.end);
  const head = calloutHeadOf(lines[0] ?? "", state.parts);
  if (head === void 0) {
    pushMarkdown(state, chunk);
    return;
  }
  const { type, closed, title } = head;
  const index = closed ? state.foldCount.value++ : -1;
  const inner = lines.slice(1).map((line, offset) => {
    const prefix = /^\s*>\s?/.exec(line)?.[0].length ?? 0;
    return {
      text: line.slice(prefix),
      prefix: prefix + (state.prefixes[chunk.start + 1 + offset] ?? 0)
    };
  });
  const body = splitInto({
    text: inner.map((line) => line.text).join("\n"),
    parts: state.parts,
    foldCount: state.foldCount,
    figures: state.figures,
    lineBase: lineOf(state, chunk),
    prefixes: inner.map((line) => line.prefix)
  });
  push(state, {
    kind: "callout",
    line: lineOf(state, chunk),
    callout: { type, ...title === "" ? {} : { title }, closed, body },
    ...closed ? { fold: { title: title || type, index, body } } : {}
  });
};
var itemLines = (state, from, to) => {
  const lines = state.lines.slice(from, to);
  const width = /^\s*\d+[.)]\s*/.exec(lines[0] ?? "")?.[0].length ?? 0;
  return lines.map((line, offset) => {
    const removed = offset === 0 ? width : Math.min(width, line.length - line.trimStart().length);
    return {
      text: line.slice(removed),
      prefix: removed + (state.prefixes[from + offset] ?? 0)
    };
  });
};
var handleSteps = (state, chunk) => {
  state.inSteps = false;
  const level = (chunk.tokens[0]?.level ?? 0) + 1;
  const items = chunk.tokens.filter((token) => token.type === "list_item_open" && token.level === level).map((token) => {
    const [from = 0, to = from] = token.map ?? [];
    const inner = itemLines(state, from, to);
    return splitInto({
      text: inner.map((line) => line.text).join("\n"),
      parts: state.parts,
      foldCount: state.foldCount,
      figures: state.figures,
      lineBase: state.lineBase + from,
      prefixes: inner.map((line) => line.prefix)
    });
  });
  push(state, { kind: "steps", line: lineOf(state, chunk), steps: { items } });
};
var CHUNK_HANDLERS = /* @__PURE__ */ new Map([
  ["html_block", handleHtml],
  ["heading_open", handleHeading],
  ["table_open", handleTable],
  ["fence", handleFence],
  ["code_block", handleFence],
  ["blockquote_open", handleQuote]
]);
var handleChunk = (state, chunk) => {
  const type = chunk.tokens[0]?.type ?? "";
  if (type !== "html_block" && type !== "table_open") {
    state.pendingFigure = void 0;
  }
  if (type === "ordered_list_open" && state.inSteps === true) {
    handleSteps(state, chunk);
    return;
  }
  (CHUNK_HANDLERS.get(type) ?? pushMarkdown)(state, chunk);
};
var splitInto = (options) => {
  const lines = options.text.split("\n");
  const state = {
    lines,
    lineBase: options.lineBase,
    prefixes: options.prefixes,
    parts: options.parts,
    out: [],
    frames: [],
    foldCount: options.foldCount,
    figures: options.figures
  };
  for (const chunk of chunksOf(MD.parse(options.text, {}))) {
    handleChunk(state, chunk);
  }
  while (state.frames.length > 0) {
    closeFrame(state);
  }
  return state.out;
};
var FIGURE_LINK = /\[([^\]]*)\]\(#fig-([^)\s]+)\)/g;
var replaceFigureLinks = (text2, columns, ids) => {
  let out = "";
  const mapped = [];
  let from = 0;
  const keep = (end) => {
    out += text2.slice(from, end);
    for (let at = from; at < end; at += 1) {
      mapped.push(columns?.[at] ?? at);
    }
  };
  for (const match of text2.matchAll(FIGURE_LINK)) {
    const figure = ids.get(match[2] ?? "");
    if (figure === void 0) {
      continue;
    }
    const labelAt = match.index + 1;
    keep(labelAt);
    const label = `\u8868 ${figure}`;
    out += label;
    for (let at = 0; at < label.length; at += 1) {
      mapped.push(columns?.[labelAt] ?? labelAt);
    }
    from = labelAt + (match[1] ?? "").length;
  }
  if (from === 0) {
    return { text: text2, columns };
  }
  keep(text2.length);
  return { text: out, columns: columns === void 0 ? void 0 : mapped };
};
var innerBlocks = (block2) => {
  const { callout, fold, steps, stack, table: table2 } = block2;
  const lists = [
    callout === void 0 ? fold?.body : callout.body,
    steps?.items.flat(),
    stack?.sections.flatMap((section) => section.body),
    table2?.details?.flatMap((detail) => detail.body)
  ];
  return lists.flatMap((list2) => list2 ?? []);
};
var numberMarkdown = (block2, ids) => {
  if (block2.markdown === void 0) {
    return;
  }
  const lines = block2.markdown.split("\n").map(
    (line, index) => replaceFigureLinks(line, block2.columns?.[index], ids)
  );
  block2.markdown = lines.map((line) => line.text).join("\n");
  if (block2.columns !== void 0) {
    block2.columns = lines.map((line) => line.columns ?? []);
  }
};
var numberTable = (block2, ids) => {
  const table2 = block2.table;
  if (table2 === void 0) {
    return;
  }
  const cell = (text2) => replaceFigureLinks(text2, void 0, ids).text;
  table2.header = table2.header.map(cell);
  table2.rows = table2.rows.map((row) => row.map(cell));
};
var numberFigureLinks = (blocks, ids) => {
  for (const block2 of blocks) {
    numberMarkdown(block2, ids);
    numberTable(block2, ids);
    numberFigureLinks(innerBlocks(block2), ids);
  }
};
var splitBlocks = (options) => {
  const figures = { count: 0, ids: /* @__PURE__ */ new Map() };
  const blocks = splitInto({
    text: options.text,
    parts: options.parts,
    foldCount: { value: 0 },
    figures,
    lineBase: 0,
    prefixes: []
  });
  if (options.parts.figure && figures.ids.size > 0) {
    numberFigureLinks(blocks, figures.ids);
  }
  return blocks;
};

// src/mdmark-style/table-layout.ts
var COLUMN_PADDING = 3;
var MIN_COLUMN_WIDTH = 4;
var SEGMENTER = new Intl.Segmenter(void 0, { granularity: "grapheme" });
var WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Extended_Pictographic}/u;
var ZERO_WIDTH = /^[\p{Mn}\p{Me}​-‏]+$/u;
var graphemeWidth = (grapheme) => {
  if (ZERO_WIDTH.test(grapheme)) {
    return 0;
  }
  return WIDE.test(grapheme) ? 2 : 1;
};
var displayWidth = (text2) => {
  let width = 0;
  for (const { segment } of SEGMENTER.segment(text2)) {
    width += graphemeWidth(segment);
  }
  return width;
};
var splitWords = (text2) => {
  const words = [];
  let current = "";
  for (const { segment } of SEGMENTER.segment(text2)) {
    const wide = graphemeWidth(segment) === 2;
    if (wide) {
      if (current !== "") {
        words.push(current);
      }
      words.push(segment);
      current = "";
    } else if (segment === " ") {
      words.push(`${current} `);
      current = "";
    } else {
      current += segment;
    }
  }
  if (current !== "") {
    words.push(current);
  }
  return words;
};
var breakWord = (word, width) => {
  const pieces = [];
  let current = "";
  for (const { segment } of SEGMENTER.segment(word)) {
    if (current !== "" && displayWidth(current + segment) > width) {
      pieces.push(current);
      current = "";
    }
    current += segment;
  }
  if (current !== "") {
    pieces.push(current);
  }
  return pieces;
};
var wrapCell = (options) => {
  const { text: text2, width } = options;
  const lines = [];
  let current = "";
  for (const word of splitWords(text2)) {
    const trimmed = word.trimEnd();
    if (displayWidth(current + trimmed) <= width) {
      current += word;
      continue;
    }
    if (current.trimEnd() !== "") {
      lines.push(current.trimEnd());
    }
    current = "";
    if (displayWidth(trimmed) <= width) {
      current = word;
      continue;
    }
    const pieces = breakWord(trimmed, width);
    lines.push(...pieces.slice(0, -1));
    current = `${pieces.at(-1) ?? ""}${word.endsWith(" ") ? " " : ""}`;
  }
  if (current.trimEnd() !== "") {
    lines.push(current.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
};
var longestWord = (cells) => Math.max(
  0,
  ...cells.flatMap(
    (cell) => splitWords(cell).map((word) => displayWidth(word.trimEnd()))
  )
);
var shrinkWidest = (widths, floors) => {
  let widest = -1;
  for (const [index, width] of widths.entries()) {
    const wider = widest < 0 || width > (widths[widest] ?? 0);
    if (width > (floors[index] ?? 0) && wider) {
      widest = index;
    }
  }
  if (widest < 0) {
    return false;
  }
  widths[widest] = (widths[widest] ?? 0) - 1;
  return true;
};
var fitColumns = (options) => {
  const { cells, columns, wrap } = options;
  const count = Math.max(0, ...cells.map((row) => row.length));
  const columnCells = Array.from(
    { length: count },
    (_, column) => cells.map((row) => row[column] ?? "")
  );
  const widths = columnCells.map(
    (column) => Math.max(0, ...column.map(displayWidth))
  );
  if (!wrap || columns === void 0) {
    return widths;
  }
  const floors = columnCells.map(
    (column, index) => Math.min(
      widths[index] ?? 0,
      Math.max(1, Math.min(longestWord(column), MIN_COLUMN_WIDTH))
    )
  );
  const total = () => widths.reduce((sum, width) => sum + width, 0) + count * COLUMN_PADDING + 1;
  while (total() > columns && shrinkWidest(widths, floors)) {
  }
  return widths;
};

// src/mdmark-style/document-parts.tsx
var TREE_NOTE_GAP = 2;
var renderSteps = (options) => {
  const { block: block2, context, renderBody } = options;
  const { Box, Text: Text3 } = context.elements;
  const items = block2.steps?.items ?? [];
  const heading2 = styleColor({ name: "heading", theme: context.theme });
  const border = styleColor({ name: "border", theme: context.theme });
  return h(
    Box,
    { key: `steps-${block2.line}`, flexDirection: "column" },
    ...items.flatMap((item, index) => [
      h(
        Box,
        { key: `step-${index}`, flexDirection: "row" },
        h(Text3, { bold: true, color: heading2 }, String(index + 1)),
        h(Text3, null, " "),
        h(Box, { flexDirection: "column" }, renderBody(item))
      ),
      index < items.length - 1 ? h(Text3, { key: `step-line-${index}`, color: border }, "\u2502") : void 0
    ])
  );
};
var renderTree2 = (options) => {
  const { block: block2, context } = options;
  const { Box, Text: Text3 } = context.elements;
  const lines = block2.tree?.lines ?? [];
  const noteAt = Math.max(
    0,
    ...lines.map((line) => displayWidth(`${line.rule}${line.name}`))
  );
  return h(
    Box,
    { key: `tree-${block2.line}`, flexDirection: "column" },
    ...lines.map((line, index) => {
      const pad = noteAt - displayWidth(`${line.rule}${line.name}`) + TREE_NOTE_GAP;
      return h(
        Box,
        { key: `tree-line-${index}`, flexDirection: "row" },
        h(Text3, { dimColor: true }, line.rule),
        h(Text3, null, line.name),
        line.note === void 0 ? void 0 : h(Text3, null, " ".repeat(pad)),
        line.note === void 0 ? void 0 : h(Text3, { dimColor: true }, line.note)
      );
    })
  );
};
var renderStack = (options) => {
  const { block: block2, context, renderBody } = options;
  const { Box, Text: Text3 } = context.elements;
  const heading2 = styleColor({ name: "heading", theme: context.theme });
  return h(
    Box,
    { key: `stack-${block2.line}`, flexDirection: "column" },
    ...(block2.stack?.sections ?? []).map(
      (section, index) => section.title === void 0 ? h(
        Box,
        { key: `section-${index}`, flexDirection: "column" },
        renderBody(section.body)
      ) : h(
        Box,
        { key: `section-${index}`, flexDirection: "column" },
        h(Text3, { bold: true, color: heading2 }, section.title),
        h(
          Box,
          { flexDirection: "column", paddingLeft: 2 },
          renderBody(section.body)
        )
      )
    )
  );
};
var renderRowDetail = (options) => {
  const { key, body, context } = options;
  const { Box, Button } = context.elements;
  const open = foldStates.get(key) ?? false;
  const toggle = h(Button, {
    key: `${key}:button`,
    label: open ? "[ \u25BE ]" : "[ \u25B8 ]",
    onPress: () => {
      foldStates.set(key, !(foldStates.get(key) ?? false));
      context.ui.invalidate("ui.render");
    }
  });
  if (!open) {
    return { toggle };
  }
  return {
    toggle,
    detail: h(
      Box,
      { key: `${key}:detail`, flexDirection: "column", paddingLeft: 2 },
      body()
    )
  };
};

// src/inline/badge.syntax.ts
function splitBadgeColor(text2) {
  const at = text2.indexOf(":");
  const head = text2.slice(0, at);
  if (at < 0 || !isColorName(head)) {
    return { label: text2 };
  }
  return { color: head, label: text2.slice(at + 1) };
}

// src/inline/kbd.syntax.ts
var splitKeys = (text2) => {
  const keys = [];
  let current = "";
  for (let at = 0; at < text2.length; at++) {
    const char = text2[at];
    if (char !== "+") {
      current += char;
      continue;
    }
    if (current.trim() === "" && (at === 0 || text2[at - 1] === "+")) {
      current = "+";
      keys.push(current);
      current = "";
      continue;
    }
    keys.push(current);
    current = "";
  }
  keys.push(current);
  return keys.map((key) => key.trim()).filter((key) => key !== "");
};

// src/mdmark-style/inline-marks.ts
var CODE_SPAN = /(`+)([\s\S]*?[^`])\1(?!`)/g;
var TEXT_MARK = /\[([^\]]*)\]\{color=([^}]*)\}|==(?!\s)([^=]*[^=\s])==(?:\{color=([^}]*)\})?/g;
var HIGHLIGHT_COLOR = "yellow";
var append = (segments, segment) => {
  const last = segments.at(-1);
  if (segment.kind === "text" && last?.kind === "text") {
    last.text += segment.text;
    return;
  }
  if (segment.kind !== "text" || segment.text !== "") {
    segments.push(segment);
  }
};
var codeSegment = (options) => {
  const { raw, content, start } = options;
  if (content.startsWith("badge:")) {
    const { color, label } = splitBadgeColor(content.slice("badge:".length));
    if (label.trim() !== "") {
      return { kind: "badge", text: label, color, start };
    }
  }
  if (content.startsWith("kbd:")) {
    const keys = splitKeys(content.slice("kbd:".length));
    if (keys.length > 0) {
      return { kind: "kbd", text: "", keys, start };
    }
  }
  return { kind: "text", text: raw, start };
};
var textSegments = (segments, text2, offset) => {
  let from = 0;
  for (const match of text2.matchAll(TEXT_MARK)) {
    append(segments, {
      kind: "text",
      text: text2.slice(from, match.index),
      start: offset + from
    });
    const start = offset + match.index;
    const [, colored, colorName, highlighted, highlightName] = match;
    if (colored !== void 0) {
      append(
        segments,
        colorName !== void 0 && isColorName(colorName) ? { kind: "color", text: colored, color: colorName, start } : { kind: "text", text: colored, start }
      );
    } else {
      append(segments, {
        kind: "highlight",
        text: highlighted ?? "",
        color: highlightName !== void 0 && isColorName(highlightName) ? highlightName : HIGHLIGHT_COLOR,
        start
      });
    }
    from = match.index + match[0].length;
  }
  append(segments, {
    kind: "text",
    text: text2.slice(from),
    start: offset + from
  });
};
var splitInlineMarks = (line) => {
  const segments = [];
  let from = 0;
  for (const match of line.matchAll(CODE_SPAN)) {
    textSegments(segments, line.slice(from, match.index), from);
    append(
      segments,
      codeSegment({
        raw: match[0],
        content: match[2] ?? "",
        start: match.index
      })
    );
    from = match.index + match[0].length;
  }
  textSegments(segments, line.slice(from), from);
  return segments.length === 0 ? [{ kind: "text", text: "", start: 0 }] : segments;
};
var segmentText = (segment) => {
  if (segment.kind === "badge") {
    return ` ${segment.text} `;
  }
  if (segment.kind === "kbd") {
    return (segment.keys ?? []).map((key) => `[${key}]`).join("+");
  }
  return segment.text;
};
var inlinePlainText = (segments) => segments.map(segmentText).join("");

// src/diagram/diagram.syntax.ts
function jsonFences(tokens) {
  return tokens.filter(
    (token) => token.type === "fence" && token.info.trim().split(/\s+/)[0] === "json"
  );
}
function isRetiredDiagram(name) {
  return RETIRED_DIAGRAM_DIRECTIVES.includes(name);
}

// src/knowledge/paths.ts
function normalizePath2(path) {
  return path.split("/").filter((segment) => segment !== "" && segment !== ".").join("/");
}
function fileTitle(path) {
  const name = normalizePath2(path).split("/").at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

// src/render/sanitize.ts
var import_sanitize_html = __toESM(require_sanitize_html(), 1);
var KEEP_CLASS_ATTRIBUTE = "data-mdmark-keep-class";
var SYNTAX_CLASS_PATTERN = /^(?:mdmark-|markdown-alert|has-tip$|has-link$|has-children$|is-virtual$|is-after-ref$)/;
var DIAGRAM_ONLY_TAGS = /* @__PURE__ */ new Set([
  "svg",
  "defs",
  "marker",
  "pattern",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "button",
  "output",
  "label"
]);
var DROP_ATTRIBUTE = "data-mdmark-drop";
var MEDIA_TAGS = /* @__PURE__ */ new Set(["video", "audio"]);
var SOURCE_LINE_ATTRIBUTE = "data-source-line";
var DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]*(?:#only-(?:light|dark))?$/;
var DATA_IMAGE_ATTRIBUTES = {
  img: "src",
  video: "poster"
};
var isForbiddenDataUrl = (url) => url?.startsWith("data:") === true && !DATA_IMAGE_PATTERN.test(url);
function dropDataUrls(tagName, attribs) {
  const imageAttribute = Object.hasOwn(DATA_IMAGE_ATTRIBUTES, tagName) ? DATA_IMAGE_ATTRIBUTES[tagName] : void 0;
  if (imageAttribute !== void 0 && isForbiddenDataUrl(attribs[imageAttribute])) {
    delete attribs[imageAttribute];
  }
  if (MEDIA_TAGS.has(tagName) && attribs.src?.startsWith("data:")) {
    delete attribs.src;
  }
}
var isPreOrTable = (tagName) => tagName === "pre" || tagName === "table";
var ATTRIBUTE_KEEPERS = {
  // 外部ライブラリのマーカーの場所の `status` だけを残す
  role: (tagName, value) => tagName === "div" && value === "status",
  "aria-label": isPreOrTable,
  tabindex: isPreOrTable,
  [SOURCE_LINE_ATTRIBUTE]: () => true
};
var DIAGRAM_ATTRIBUTES = [
  "tabindex",
  "style",
  "for",
  "type",
  "min",
  "max",
  "step",
  "value",
  "disabled",
  "datetime",
  "d",
  "viewbox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "marker-end",
  "markerwidth",
  "markerheight",
  "markerunits",
  "patternunits",
  "refx",
  "refy",
  "orient",
  "transform",
  "text-anchor"
];
var DIAGRAM_ATTRIBUTE_SET = new Set(DIAGRAM_ATTRIBUTES);
var SANITIZE_OPTIONS = {
  allowedTags: [
    ...import_sanitize_html.default.defaults.allowedTags,
    "img",
    "del",
    "details",
    "summary",
    "input",
    "nav",
    "figure",
    "figcaption",
    "style",
    "template",
    ...MEDIA_TAGS,
    ...DIAGRAM_ONLY_TAGS
  ],
  allowedAttributes: {
    "*": [
      "id",
      "role",
      "aria-*",
      "data-*",
      "hidden",
      "colspan",
      "rowspan",
      "scope",
      ...DIAGRAM_ATTRIBUTES
    ],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    // ER 図の列のマーカーの名前（文書に記載した `abbr` の `title` は `dropSyntaxAttributes` が落とす）
    abbr: ["title"],
    details: ["open"],
    input: ["type", "disabled", "checked"],
    pre: ["tabindex"],
    table: ["tabindex"],
    span: ["tabindex"],
    video: [
      "src",
      "controls",
      "autoplay",
      "muted",
      "loop",
      "playsinline",
      "preload",
      "poster"
    ],
    audio: ["src", "controls", "autoplay", "muted", "loop", "preload"]
  },
  // 図の部品の要素以外から取り除く要素は、マーカーを付けた要素を中身ごと削除する
  exclusiveFilter: (frame) => frame.attribs[DROP_ATTRIBUTE] !== void 0,
  // 記法の class は、mdmark が出した要素だけが持つ（生の HTML のものは `transformTags` が先に落とす）
  allowedClasses: {
    "*": [
      "mdmark-*",
      "markdown-alert*",
      "has-tip",
      "has-link",
      "has-children",
      "is-virtual",
      "is-after-ref"
    ],
    code: ["language-*"],
    li: ["task-list-item"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  // 画像の `src` と動画の `poster` は `data:` URL も許す（残す構造は `transformTags` が絞る）
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    video: ["http", "https", "data"],
    audio: ["http", "https", "data"]
  },
  // postcss を呼ばない。`style` 属性は許可せず、列の配置だけを class に移す
  parseStyleAttributes: false,
  // 範囲の `style` は mdmark が根の要素の中に限って出したものだけを残す（文書に記載したものは `transformTags` が落とす）
  allowVulnerableTags: true,
  // 値の無い `hidden`（CSV の表の元の CSV）を残す。文書に記載した `hidden` は `dropSyntaxAttributes` が先に落とす
  nonBooleanAttributes: import_sanitize_html.default.defaults.nonBooleanAttributes.filter(
    (name) => name !== "hidden"
  )
};
var EMBED_STYLES = (() => {
  const length = String.raw`-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|ch|pt|fr)?`;
  const unsigned = String.raw`(?:\d+|\d*\.\d+)(?:px|rem|em|%|ch|pt|fr)?`;
  const keyword = "[a-z]+(?:-[a-z]+)*";
  const color = String.raw`#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\(\s*[0-9.%\s,/-]+\)|var\(--mdmark-[a-z0-9-]+\)`;
  const fn = String.raw`(?:repeat|minmax)\([a-z0-9\s,.%-]*\)`;
  const words = (tokens) => new RegExp(`^(?:${tokens})(?:\\s+(?:${tokens}))*$`, "i");
  return [
    {
      name: /^display$/,
      value: /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|none)$/i
    },
    {
      name: /^(?:flex(?:-(?:direction|wrap|grow|shrink|basis))?|align-items|justify-content|align-self)$/,
      value: words(`${keyword}|${length}`)
    },
    {
      name: /^(?:grid-template-columns|grid-template-rows|grid-column|grid-row|gap|row-gap|column-gap)$/,
      value: words(`${keyword}|${length}|${fn}`)
    },
    {
      name: /^(?:margin|padding)(?:-[a-z-]+)?$/,
      value: words(`${unsigned}|auto`)
    },
    {
      name: /^border(?:-(?!image)[a-z-]+)?$/,
      value: words(`${length}|${color}`)
    },
    {
      name: /^(?:width|max-width|min-width|height)$/,
      value: words(`${length}|${keyword}`)
    },
    { name: /^(?:color|background-color)$/, value: words(color) },
    {
      name: /^(?:font-size|font-weight|text-align)$/,
      value: words(`${length}|${keyword}`)
    }
  ];
})();
var EMBED_STYLE_FORBIDDEN = /\/\*|["'\\]|url\(|expression\(|\d\s*(?:dvw|dvh|svw|svh|lvw|lvh|vmin|vmax|vw|vh)\b/i;
function filterEmbeddedStyle(style) {
  const kept = [];
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) {
      continue;
    }
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim().replace(/\s+/g, " ");
    if (value !== "" && !EMBED_STYLE_FORBIDDEN.test(value) && EMBED_STYLES.some(
      (entry) => entry.name.test(name) && entry.value.test(value)
    )) {
      kept.push(`${name}:${value}`);
    }
  }
  return kept.join(";");
}
var EMBED_PART_TAG = "mdmark-part";
var EMBED_PART_ATTRIBUTE = "data-part";
var TEXT_FILTER_SKIP_TAGS = /* @__PURE__ */ new Set([
  "a",
  "code",
  "pre",
  "button",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
]);
var EMBEDDED_NON_TEXT_TAGS = [
  "script",
  "style",
  "textarea",
  "option",
  "xmp"
];
var EMBEDDED_OPTIONS = {
  ...SANITIZE_OPTIONS,
  allowedTags: [
    ...SANITIZE_OPTIONS.allowedTags,
    "button",
    EMBED_PART_TAG
  ],
  allowedAttributes: {
    "*": ["data-hint", "style", "colspan", DROP_ATTRIBUTE],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    details: ["open"],
    input: ["type", "disabled", "checked"],
    button: ["type"],
    [EMBED_PART_TAG]: [EMBED_PART_ATTRIBUTE]
  },
  allowedClasses: {},
  nonTextTags: EMBEDDED_NON_TEXT_TAGS
};
function sanitizeEmbedded(html, onText, keepClasses = false) {
  return (0, import_sanitize_html.default)(html, {
    ...EMBEDDED_OPTIONS,
    ...keepClasses ? {
      allowedAttributes: {
        ...EMBEDDED_OPTIONS.allowedAttributes,
        "*": [
          ...EMBEDDED_OPTIONS.allowedAttributes["*"] ?? [],
          "class",
          KEEP_CLASS_ATTRIBUTE
        ]
      },
      allowedClasses: void 0
    } : {},
    textFilter: (text2, tagName) => TEXT_FILTER_SKIP_TAGS.has(tagName) ? text2 : onText(text2),
    transformTags: {
      "*": (tagName, attribs) => {
        if (tagName === "input") {
          return { tagName, attribs: embeddedCheckbox(attribs) };
        }
        const next = { ...attribs };
        const style = filterEmbeddedStyle(attribs.style ?? "");
        if (style === "") {
          delete next.style;
        } else {
          next.style = style;
        }
        if (tagName === "button") {
          next.type = "button";
        }
        delete next[KEEP_CLASS_ATTRIBUTE];
        if (keepClasses) {
          keepAuthorClasses(next);
        }
        dropDataUrls(tagName, next);
        if (DIAGRAM_ONLY_TAGS.has(tagName) && tagName !== "button") {
          next[DROP_ATTRIBUTE] = "1";
        }
        return { tagName, attribs: next };
      }
    }
  });
}
function embeddedCheckbox(attribs) {
  const checkbox = { type: "checkbox", disabled: "" };
  if (attribs.checked !== void 0) {
    checkbox.checked = "";
  }
  return checkbox;
}
function keepAuthorClasses(next) {
  if (next.class === void 0) {
    return;
  }
  const classes = next.class.split(/\s+/).filter((name) => name !== "" && !SYNTAX_CLASS_PATTERN.test(name));
  if (classes.length > 0) {
    next.class = classes.join(" ");
    next[KEEP_CLASS_ATTRIBUTE] = "";
  } else {
    delete next.class;
  }
}

// src/embedded-html/embedded-html.syntax.ts
var PART_PATTERN = /<mdmark-(flow|sequence|chart|param)\b[^>]*>([\s\S]*?)<\/mdmark-\1\s*>/gi;
function isHtmlFence(token) {
  return token.type === "fence" && token.info.trim().split(/\s+/)[0] === "html";
}
function unescapeHtml(text2) {
  return text2.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

// src/knowledge/index-shape.ts
var RELATION_TYPES = [
  "requires",
  "references",
  "replaces",
  "part_of",
  "change_together"
];
var INDEX_SHAPE = {
  root: {
    schema: { type: "integer", required: true },
    docs: { type: "array", required: true },
    terms: { type: "array", required: false }
  },
  doc: {
    id: { type: "string", required: true },
    path: { type: "string", required: true },
    title: { type: "string", required: false },
    description: { type: "string", required: false },
    aliases: { type: "string[]", required: false },
    tags: { type: "doc_tags", required: false },
    related: { type: "doc_related", required: false }
  },
  term: {
    id: { type: "string", required: true },
    term: { type: "string", required: true },
    meaning: { type: "string", required: true },
    aliases: { type: "string[]", required: false },
    avoid: { type: "string[]", required: false }
  }
};
var DOC_TAG_SHAPE = {
  name: { type: "string", required: true },
  main: { type: "boolean", required: false }
};
var DOC_RELATED_SHAPE = {
  to: { type: "string", required: true },
  type: { type: "string", required: true },
  when: { type: "string", required: true },
  paths: { type: "string[]", required: false }
};
var EMPTY_ALLOWED = /* @__PURE__ */ new Set(["description"]);
var CURRENT_SCHEMA = 2;
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkString(key, value) {
  if (typeof value !== "string") {
    return `${key} \u306F\u6587\u5B57\u5217\u306B\u3057\u307E\u3059`;
  }
  return value === "" && !EMPTY_ALLOWED.has(key) ? `${key} \u306F\u7A7A\u306B\u3067\u304D\u307E\u305B\u3093` : void 0;
}
function checkType(key, value, shape) {
  if (shape.type === "integer") {
    return Number.isInteger(value) ? void 0 : `${key} \u306F\u6574\u6570\u306B\u3057\u307E\u3059`;
  }
  if (shape.type === "array") {
    return Array.isArray(value) ? void 0 : `${key} \u306F\u4E26\u3073\u306B\u3057\u307E\u3059`;
  }
  if (shape.type === "boolean") {
    return typeof value === "boolean" ? void 0 : `${key} \u306F\u771F\u507D\u5024\u306B\u3057\u307E\u3059`;
  }
  if (shape.type === "string") {
    return checkString(key, value);
  }
  const ok = Array.isArray(value) && value.every((item) => typeof item === "string" && item !== "");
  return ok ? void 0 : `${key} \u306F\u7A7A\u3067\u306A\u3044\u6587\u5B57\u5217\u306E\u4E26\u3073\u306B\u3057\u307E\u3059`;
}
function checkDocTags(options) {
  const { value, where, problems } = options;
  if (!Array.isArray(value)) {
    problems.push({ where, message: "tags \u306F\u4E26\u3073\u306B\u3057\u307E\u3059" });
    return false;
  }
  let valid = true;
  value.forEach((tag, position) => {
    const tagWhere = `${where}[${position}]`;
    if (typeof tag === "string") {
      if (tag === "") {
        problems.push({
          where: tagWhere,
          message: "tags \u306E\u8981\u7D20\u306F\u7A7A\u306B\u3067\u304D\u307E\u305B\u3093"
        });
        valid = false;
      }
      return;
    }
    if (!isRecord4(tag)) {
      problems.push({
        where: tagWhere,
        message: "tags \u306E\u8981\u7D20\u306F\u30BF\u30B0\u306E\u540D\u524D\u306E\u6587\u5B57\u5217\u304B\u3001name \u3092\u6301\u3064\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059"
      });
      valid = false;
      return;
    }
    if (!checkItem({ item: tag, shape: DOC_TAG_SHAPE, where: tagWhere, problems })) {
      valid = false;
    }
  });
  return valid;
}
function checkDocRelated(options) {
  const { value, where, problems } = options;
  if (!Array.isArray(value)) {
    problems.push({ where, message: "related \u306F\u4E26\u3073\u306B\u3057\u307E\u3059" });
    return false;
  }
  let valid = true;
  value.forEach((related, position) => {
    const relatedWhere = `${where}[${position}]`;
    if (typeof related === "string") {
      if (related === "") {
        problems.push({
          where: relatedWhere,
          message: "related \u306E\u8981\u7D20\u306F\u7A7A\u306B\u3067\u304D\u307E\u305B\u3093"
        });
        valid = false;
      }
      return;
    }
    if (!isRecord4(related)) {
      problems.push({
        where: relatedWhere,
        message: "related \u306E\u8981\u7D20\u306F\u6587\u66F8\u306E id \u306E\u6587\u5B57\u5217\u304B\u3001to\u30FBtype\u30FBwhen \u3092\u6301\u3064\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059"
      });
      valid = false;
      return;
    }
    if (!checkItem({
      item: related,
      shape: DOC_RELATED_SHAPE,
      where: relatedWhere,
      problems
    })) {
      valid = false;
    }
    const { type } = related;
    if (typeof type === "string" && type !== "" && !RELATION_TYPES.includes(type)) {
      problems.push({
        where: `${relatedWhere}.type`,
        message: `type \u306F ${RELATION_TYPES.join("\u30FB")} \u306E\u3069\u308C\u304B\u306B\u3057\u307E\u3059`
      });
      valid = false;
    }
  });
  return valid;
}
function checkKey(options) {
  const { value, key, shape, where, problems } = options;
  if (value === void 0) {
    if (shape.required) {
      problems.push({ where, message: `${key} \u304C\u3042\u308A\u307E\u305B\u3093` });
    }
    return !shape.required;
  }
  if (shape.type === "doc_tags") {
    return checkDocTags({ value, where, problems });
  }
  if (shape.type === "doc_related") {
    return checkDocRelated({ value, where, problems });
  }
  const message = checkType(key, value, shape);
  if (message) {
    problems.push({ where, message });
  }
  return message === void 0;
}
function checkItem(options) {
  const { item, shape, where, problems } = options;
  if (!isRecord4(item)) {
    problems.push({ where, message: `${where} \u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059` });
    return false;
  }
  let valid = true;
  for (const [key, keyShape] of Object.entries(shape)) {
    const checked = checkKey({
      value: item[key],
      key,
      shape: keyShape,
      where: `${where}.${key}`,
      problems
    });
    valid = checked && valid;
  }
  for (const key of Object.keys(item)) {
    if (!Object.hasOwn(shape, key)) {
      problems.push({
        where: `${where}.${key}`,
        message: `${key} \u306F\u7D22\u5F15\u306B\u8A18\u8F09\u3067\u304D\u306A\u3044\u30AD\u30FC\u3067\u3059`
      });
      valid = false;
    }
  }
  return valid;
}
function checkList(options) {
  const { list: list2, name, shape, unique, problems } = options;
  const seen = new Map(
    unique.map((key) => [key, /* @__PURE__ */ new Set()])
  );
  const items = [];
  list2.forEach((item, position) => {
    const where = `${name}[${position}]`;
    if (!checkItem({ item, shape, where, problems })) {
      return;
    }
    const record = item;
    const duplicated = unique.filter((key) => seen.get(key)?.has(record[key]));
    for (const key of duplicated) {
      problems.push({
        where: `${where}.${key}`,
        message: `${key} \u304C\u5148\u306E\u8981\u7D20\u3068\u91CD\u306A\u3063\u3066\u3044\u307E\u3059`
      });
    }
    if (duplicated.length) {
      return;
    }
    for (const key of unique) {
      seen.get(key)?.add(record[key]);
    }
    items.push(item);
  });
  return items;
}
function normalizeIndex(value) {
  const problems = [];
  const index = { schema: CURRENT_SCHEMA, docs: [] };
  if (!isRecord4(value)) {
    problems.push({ where: "", message: "\u7D22\u5F15\u306F\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u306B\u3057\u307E\u3059" });
    return { index, problems };
  }
  if (value.schema !== CURRENT_SCHEMA && Number.isInteger(value.schema)) {
    problems.push({
      where: "schema",
      message: `schema \u306F ${CURRENT_SCHEMA} \u306B\u3057\u307E\u3059\u3002\u53E4\u3044\u30D0\u30FC\u30B8\u30E7\u30F3\u306E\u7D22\u5F15\u306F mdmark upgrade \u3067\u79FB\u3057\u3066\u304F\u3060\u3055\u3044`
    });
  }
  const root = [];
  checkItem({
    item: { ...value, docs: [], terms: [] },
    shape: INDEX_SHAPE.root,
    where: "",
    problems: root
  });
  for (const problem of root) {
    const key = problem.where.slice(1);
    if (key !== "docs" && key !== "terms") {
      problems.push({ where: key, message: problem.message });
    }
  }
  index.docs = checkTop({
    list: value.docs,
    name: "docs",
    shape: INDEX_SHAPE.doc,
    unique: ["id", "path"],
    required: true,
    problems
  });
  if (value.terms !== void 0) {
    index.terms = checkTop({
      list: value.terms,
      name: "terms",
      shape: INDEX_SHAPE.term,
      unique: ["id"],
      required: false,
      problems
    });
  }
  return { index, problems };
}
function checkTop(options) {
  const { list: list2, name, required, problems } = options;
  if (list2 === void 0) {
    if (required) {
      problems.push({ where: name, message: `${name} \u304C\u3042\u308A\u307E\u305B\u3093` });
    }
    return [];
  }
  if (!Array.isArray(list2)) {
    problems.push({ where: name, message: `${name} \u306F\u4E26\u3073\u306B\u3057\u307E\u3059` });
    return [];
  }
  return checkList({ ...options, list: list2 });
}

// src/knowledge/positions.ts
var { unescapeAll: unescapeAll2 } = new MarkdownItCallable().utils;
var ENTITY_PATTERN = /^&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;
var ENTITY_MAX_LENGTH = 40;
var MASK_CHAR = "\0";
var TAG_PATTERN = /<(\/?)([A-Za-z][A-Za-z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/y;
var DECLARATION_PATTERN = /<[!?][^>]*>/y;
var PART_AT_PATTERN = new RegExp(PART_PATTERN.source, "iy");
var VOID_TAGS = /* @__PURE__ */ new Set(["img", "br", "hr", "input", "wbr"]);
var DROPPED_TAGS = /* @__PURE__ */ new Set([
  ...EMBEDDED_NON_TEXT_TAGS,
  ...[...DIAGRAM_ONLY_TAGS].filter((tag) => tag !== "button")
]);
function entityAt(options) {
  const { body, at, text: text2, position } = options;
  if (body[at] !== "&") {
    return void 0;
  }
  const entity2 = ENTITY_PATTERN.exec(
    body.slice(at, at + ENTITY_MAX_LENGTH)
  )?.[0];
  if (entity2 === void 0) {
    return void 0;
  }
  const decoded = unescapeAll2(entity2);
  return decoded !== entity2 && text2.startsWith(decoded, position) ? { entity: entity2, decoded } : void 0;
}
function alignStep(options) {
  const { body, text: text2, at, position } = options;
  if (at >= body.length) {
    return { offsets: [body.length], at, position: position + 1 };
  }
  const char = text2[position];
  if (body[at] === "\\" && body[at + 1] === char) {
    return { offsets: [at], at: at + 2, position: position + 1 };
  }
  const found = entityAt(options);
  if (found) {
    return {
      offsets: Array.from({ length: found.decoded.length }, () => at),
      at: at + found.entity.length,
      position: position + found.decoded.length
    };
  }
  if (body[at] === char) {
    return { offsets: [at], at: at + 1, position: position + 1 };
  }
  return { offsets: [], at: at + 1, position };
}
function alignText(options) {
  const { body, text: text2 } = options;
  const offsets = [];
  let at = options.cursor;
  let position = 0;
  while (position < text2.length) {
    const step = alignStep({ body, text: text2, at, position });
    offsets.push(...step.offsets);
    at = step.at;
    position = step.position;
  }
  offsets.push(at);
  return { offsets, end: at };
}
function skipTitleQuote(options) {
  const { body, position, open } = options;
  const char = body[position] ?? "";
  const quote = open === "(" && (char === '"' || char === "'") && /\s/.test(body[position - 1] ?? "");
  if (!quote) {
    return position;
  }
  const quoteEnd = body.indexOf(char, position + 1);
  return quoteEnd >= 0 ? quoteEnd : position;
}
function skipGroup(options) {
  const { body, at, open, close } = options;
  let depth = 0;
  for (let position = at; position < body.length; position++) {
    const char = body[position];
    if (char === "\\") {
      position += 1;
      continue;
    }
    position = skipTitleQuote({ body, position, open });
    if (char === open) {
      depth += 1;
    } else if (char === close && depth === 1) {
      return position + 1;
    } else if (char === close) {
      depth -= 1;
    }
  }
  return at + 1;
}
function locateLine(body, from, line) {
  const text2 = line.trimEnd();
  if (text2 === "") {
    return from;
  }
  const at = body.indexOf(text2, from);
  return at < 0 ? from : at;
}
function skipDestination(body, cursor) {
  if (body[cursor] === "(") {
    return skipGroup({ body, at: cursor, open: "(", close: ")" });
  }
  if (body[cursor] === "[") {
    return skipGroup({ body, at: cursor, open: "[", close: "]" });
  }
  return cursor;
}
function codeClose(body, from, length) {
  let at = from;
  while (at < body.length) {
    const next = body.indexOf("`", at);
    if (next < 0) {
      return void 0;
    }
    let run = next;
    while (body[run] === "`") {
      run += 1;
    }
    if (run - next === length) {
      return run;
    }
    at = run;
  }
  return void 0;
}
var advanceCode = (child, cursor, { body }) => {
  const open = body.indexOf(child.markup, cursor);
  if (open < 0) {
    return cursor;
  }
  const from = open + child.markup.length;
  return codeClose(body, from, child.markup.length) ?? open + child.markup.length * 2 + child.content.length;
};
var advanceLinkOpen = (child, cursor, { body }) => {
  if (child.markup === "autolink") {
    return Math.max(cursor, body.indexOf("<", cursor) + 1);
  }
  if (child.markup === "linkify") {
    return cursor;
  }
  return Math.max(cursor, body.indexOf("[", cursor) + 1);
};
var advanceLinkClose = (child, cursor, { body }) => {
  if (child.markup === "linkify") {
    return cursor;
  }
  if (body[cursor] === ">") {
    return cursor + 1;
  }
  const close = body.indexOf("]", cursor);
  return close < 0 ? cursor : skipDestination(body, close + 1);
};
var advanceImage = (_, cursor, { body }) => {
  const open = body.indexOf("![", cursor);
  if (open < 0) {
    return cursor;
  }
  return skipDestination(
    body,
    skipGroup({ body, at: open + 1, open: "[", close: "]" })
  );
};
var advanceBreak = (_, cursor, { body, first, lines }) => {
  const newline2 = body.indexOf("\n", cursor);
  const next = newline2 < 0 ? body.length : newline2 + 1;
  const passed = body.slice(first, next).split("\n").length - 1;
  return locateLine(body, next, lines[passed] ?? "");
};
var advanceHtml = (child, cursor, { body }) => {
  const at = body.indexOf(child.content, cursor);
  return at >= 0 ? at + child.content.length : cursor;
};
var advanceMarkup = (child, cursor, { body }) => child.markup !== "" && body.startsWith(child.markup, cursor) ? cursor + child.markup.length : cursor;
var ADVANCES = /* @__PURE__ */ new Map([
  ["code_inline", advanceCode],
  ["link_open", advanceLinkOpen],
  ["link_close", advanceLinkClose],
  ["image", advanceImage],
  ["softbreak", advanceBreak],
  ["hardbreak", advanceBreak],
  ["html_inline", advanceHtml]
]);
function inlineOffsets(options) {
  const { body, inline: inline2 } = options;
  const keep = new Set(matchableChildren(inline2));
  const byChild = /* @__PURE__ */ new Map();
  const lines = inline2.content.split("\n");
  const first = locateLine(body, options.start, lines[0] ?? "");
  const context = { body, first, lines };
  let cursor = first;
  (inline2.children ?? []).forEach((child, position) => {
    if (child.type !== "text") {
      cursor = (ADVANCES.get(child.type) ?? advanceMarkup)(
        child,
        cursor,
        context
      );
      return;
    }
    const aligned = alignText({ body, cursor, text: child.content });
    if (keep.has(position)) {
      byChild.set(position, aligned.offsets);
    }
    cursor = aligned.end;
  });
  return { byChild, end: cursor };
}
function elementEnd(html, from, name) {
  const pattern = new RegExp(
    `<(/?)${name}(?![A-Za-z0-9-])((?:"[^"]*"|'[^']*'|[^'">])*)>`,
    "gi"
  );
  pattern.lastIndex = from;
  let depth = 1;
  for (let found = pattern.exec(html); found; found = pattern.exec(html)) {
    if (found[1] === "/") {
      depth -= 1;
      if (depth === 0) {
        return pattern.lastIndex;
      }
    } else if (!found[2]?.endsWith("/")) {
      depth += 1;
    }
  }
  return html.length;
}
var maskComment = (html, at, { hidden }) => {
  if (!html.startsWith("<!--", at)) {
    return void 0;
  }
  const close = html.indexOf("-->", at + 4);
  const end = close < 0 ? html.length : close + 3;
  hidden.fill(1, at, end);
  return end;
};
var maskPattern = (pattern) => (html, at, { hidden }) => {
  pattern.lastIndex = at;
  const found = pattern.exec(html);
  if (!found) {
    return void 0;
  }
  hidden.fill(1, at, at + found[0].length);
  return at + found[0].length;
};
var maskTag = (html, at, { hidden, open }) => {
  TAG_PATTERN.lastIndex = at;
  const tag = TAG_PATTERN.exec(html);
  if (!tag) {
    return void 0;
  }
  const name = tag[2].toLowerCase();
  const end = at + tag[0].length;
  hidden.fill(1, at, end);
  if (tag[1] === "/") {
    const position = open.lastIndexOf(name);
    if (position >= 0) {
      open.length = position;
    }
    return end;
  }
  if ((tag[3] ?? "").endsWith("/") || VOID_TAGS.has(name)) {
    return end;
  }
  if (DROPPED_TAGS.has(name)) {
    const close = elementEnd(html, end, name);
    hidden.fill(1, at, close);
    return close;
  }
  open.push(name);
  return end;
};
var MASKERS = [
  maskComment,
  maskPattern(PART_AT_PATTERN),
  maskTag,
  maskPattern(DECLARATION_PATTERN)
];
function maskMarkup(html, at, state) {
  for (const mask of MASKERS) {
    const next = mask(html, at, state);
    if (next !== void 0) {
      return next;
    }
  }
  return void 0;
}
function maskEmbeddedHtml(html) {
  const state = { hidden: new Uint8Array(html.length), open: [] };
  let at = 0;
  while (at < html.length) {
    const next = html[at] === "<" ? maskMarkup(html, at, state) : void 0;
    if (next !== void 0) {
      at = next;
      continue;
    }
    const innermost = state.open.at(-1);
    if (innermost !== void 0 && TEXT_FILTER_SKIP_TAGS.has(innermost)) {
      state.hidden[at] = 1;
    }
    at += 1;
  }
  let masked = "";
  for (let position = 0; position < html.length; position++) {
    masked += state.hidden[position] ? MASK_CHAR : html[position];
  }
  return masked;
}

// src/frontmatter/frontmatter.logic.ts
var OPEN_LINE = /^---[ \t]*$/;
var CLOSE_LINE = /^(?:---|\.\.\.)[ \t]*$/;
var BOM2 = "\uFEFF";
var blankOut = (text2) => text2.replace(/[^\r\n]/g, " ");
var splitFrontmatter = (markdown) => {
  const none = {
    body: markdown,
    content: void 0,
    endLine: void 0
  };
  const text2 = markdown.startsWith(BOM2) ? markdown.slice(BOM2.length) : markdown;
  const lines = text2.split("\n");
  const stripCr = (line) => line.replace(/\r$/, "");
  if (!OPEN_LINE.test(stripCr(lines[0] ?? ""))) {
    return none;
  }
  const endLine = lines.findIndex(
    (line, index) => index > 0 && CLOSE_LINE.test(stripCr(line))
  );
  if (endLine < 0) {
    return none;
  }
  const content = lines.slice(1, endLine).map(stripCr).join("\n");
  const rangeLength = markdown.length - text2.length + lines.slice(0, endLine + 1).join("\n").length;
  const body = blankOut(markdown.slice(0, rangeLength)) + markdown.slice(rangeLength);
  return { body, content, endLine };
};

// src/knowledge/glossary.syntax.ts
var ALIAS_SEPARATOR = /[、,]/;
function splitCell(cell) {
  return cell.split(ALIAS_SEPARATOR).map((word) => word.trim()).filter(Boolean);
}
function readStructure(reader, token) {
  switch (token.type) {
    case "table_open":
      reader.table = { columns: [], rows: [] };
      reader.tables.push(reader.table);
      return true;
    case "thead_open":
      reader.inHead = true;
      return true;
    case "thead_close":
      reader.inHead = false;
      return true;
    case "tr_open":
      if (!reader.inHead) {
        reader.row = { cells: [], line: (token.map?.[0] ?? 0) + 1 };
        reader.table?.rows.push(reader.row);
      }
      return true;
    default:
      return false;
  }
}
function readCell(reader, token, inline2) {
  if (token.type !== "th_open" && token.type !== "td_open") {
    return;
  }
  const text2 = inline2 ? textOf(inline2).trim() : "";
  if (token.type === "th_open") {
    reader.table?.columns.push(text2);
  } else {
    reader.row?.cells.push(text2);
  }
}
function readTables(tokens) {
  const reader = {
    tables: [],
    table: void 0,
    inHead: false,
    row: void 0
  };
  for (const [position, token] of tokens.entries()) {
    if (!readStructure(reader, token)) {
      readCell(reader, token, tokens[position + 1]);
    }
  }
  return reader.tables;
}
function unknownColumnMessage(argName, name, columns) {
  const list2 = columns.map((column) => `\`${column}\``).join("\u30FB");
  return `\u306E \`${argName}.column\` \u306E\u5217 \`${name}\` \u304C\u8868\u306B\u3042\u308A\u307E\u305B\u3093\u3002\u8868\u306E\u5217\u306F ${list2} \u3067\u3059\u3002\u5217\u540D\u3092\u4FEE\u6B63\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u3053\u306E\u8868\u304B\u3089\u306F\u7528\u8A9E\u3092\u5165\u308C\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`;
}
var GLOSSARY_COLUMNS = [
  ["term", true],
  ["meaning", true],
  ["aliases", false],
  ["avoid", false]
];
function columnPositions(spec, columns) {
  const positions = {};
  let problem;
  for (const [argName, required] of GLOSSARY_COLUMNS) {
    const name = spec[argName]?.column;
    if (typeof name !== "string" || name === "") {
      if (required) {
        problem ??= "";
      }
      continue;
    }
    const position = columns.indexOf(name);
    if (position === -1) {
      problem ??= unknownColumnMessage(argName, name, columns);
    } else {
      positions[argName] = position;
    }
  }
  return problem === void 0 ? { positions } : { problem };
}
function tableRows(table2, positions, docId) {
  const cellOf2 = (cells, argName) => cells[positions[argName] ?? -1] ?? "";
  return table2.rows.flatMap((row) => {
    const term = cellOf2(row.cells, "term");
    const meaning = cellOf2(row.cells, "meaning");
    if (term === "" || meaning === "") {
      return [];
    }
    return [
      {
        entry: {
          term,
          aliases: splitCell(cellOf2(row.cells, "aliases")),
          meaning,
          docId,
          avoid: splitCell(cellOf2(row.cells, "avoid"))
        },
        line: row.line
      }
    ];
  });
}
function readGlossaryRows(options) {
  const { options: spec, tokens, docId } = options;
  const rows = [];
  let warning;
  for (const table2 of readTables(tokens)) {
    const read = columnPositions(spec, table2.columns);
    if ("problem" in read) {
      if (read.problem !== "") {
        warning ??= read.problem;
      }
      continue;
    }
    rows.push(...tableRows(table2, read.positions, docId));
  }
  return warning === void 0 ? { rows } : { rows, warning };
}
function collectGlossary(state, range) {
  const env = envOf(state);
  const { token, mark, tokens, closed } = range;
  const { rows, warning } = readGlossaryRows({
    options: mark.options,
    tokens,
    docId: env.docId ?? ""
  });
  const out = [];
  if (!closed) {
    out.push(warningBlock(state, unclosedWarning(mark), token));
  }
  if (warning !== void 0) {
    out.push(warningBlock(state, { mark: mark.raw, message: warning }, token));
  }
  for (const row of rows) {
    env.ownGlossary.push(row.entry);
    env.glossaryLines?.push(row.line);
  }
  for (const inline2 of tokens) {
    for (const child of inline2.children ?? []) {
      child.meta = { ...child.meta, mdmarkNoTerms: true };
    }
  }
  return out;
}
var ALIAS_TABLE_COLUMNS = [
  "\u7528\u8A9E",
  "\u5225\u540D",
  "\u4F7F\u7528\u3057\u306A\u3044\u8A00\u3044\u65B9",
  "\u610F\u5473",
  "\u8A73\u7D30"
];
var COLUMN_KEYS = ["term", "meaning", "aliases", "avoid"];
var SCHEME2 = /^[a-z][a-z0-9+.-]*:/i;
function cellOf(text2) {
  return text2.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}
function relativeFrom(from, to) {
  const fromParts = from.split("/").slice(0, -1);
  const toParts = to.split("/");
  let common = 0;
  while (common < fromParts.length && common < toParts.length - 1 && fromParts[common] === toParts[common]) {
    common++;
  }
  return [
    ...fromParts.slice(common).map(() => ".."),
    ...toParts.slice(common)
  ].join("/");
}
function detailHref(href, path) {
  if (path === void 0 || SCHEME2.test(href) || href.startsWith("#")) {
    return href;
  }
  const hash = href.indexOf("#");
  const target = hash === -1 ? href : href.slice(0, hash);
  const anchor = hash === -1 ? "" : href.slice(hash);
  return `${relativeFrom(path, target)}${anchor}`;
}
function aliasRowLine(alias, path) {
  const details = (alias.details ?? []).map(
    ({ title, href }) => `[${cellOf(title).replaceAll(/[[\]]/g, "\\$&")}](<${detailHref(href, path).replaceAll(">", "%3E")}>)`
  ).join("\u30FB");
  const cells = [
    cellOf(alias.name),
    cellOf(alias.aliases.join("\u3001")),
    cellOf((alias.avoid ?? []).join("\u3001")),
    cellOf(alias.description ?? ""),
    details
  ];
  return `| ${cells.join(" | ")} |`;
}
function tableMarkTokens(state, source) {
  const make = (closing) => {
    const token = new state.Token(MARK_TOKEN, "", 0);
    token.block = true;
    token.level = source.level;
    token.map = source.map;
    const raw = closing ? "<!-- /table -->" : '<!-- table: {"kind": "data"} -->';
    const mark = {
      name: "table",
      options: closing ? {} : { kind: "data" },
      source: closing ? "none" : "json",
      problems: [],
      unknownKeys: [],
      raw,
      closing
    };
    token.meta = mark;
    return token;
  };
  return [make(false), make(true)];
}
function aliasGlossaryTokens(options) {
  const { options: spec, state } = options;
  const env = envOf(state);
  const row = String(spec.alias_row);
  const mixed = COLUMN_KEYS.filter((key) => Object.hasOwn(spec, key));
  const aliases = usableAliases(env.aliases ?? []).filter(
    (alias) => alias.alias_type === "term" && alias.row === row
  );
  if (aliases.length === 0) {
    return {
      tokens: [],
      warning: `\u306E \`alias_row\` \u306E\u884C \`${row}\` \u304B\u3089\u4F5C\u3063\u305F\u7528\u8A9E\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u8A2D\u5B9A\u306E \`aliases\` \u306B \`alias_type\` \u304C \`term\` \u306E\u884C \`${row}\` \u3092\u8A18\u8F09\u3059\u308B\u304B\u3001\`alias_row\` \u3092\u884C\u306E \`id\` \u306B\u4FEE\u6B63\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u7528\u8A9E\u96C6\u306E\u8868\u3092\u63CF\u3044\u3066\u3044\u307E\u305B\u3093\u3002`
    };
  }
  const markdown = [
    `| ${ALIAS_TABLE_COLUMNS.join(" | ")} |`,
    `| ${ALIAS_TABLE_COLUMNS.map(() => "---").join(" | ")} |`,
    ...aliases.map((alias) => aliasRowLine(alias, env.path)),
    ""
  ].join("\n");
  const parsed = [];
  state.md.block.parse(markdown, state.md, state.env, parsed);
  for (const token of parsed) {
    if (token.type === "inline") {
      token.children = [];
      state.md.inline.parse(token.content, state.md, state.env, token.children);
      for (const child of token.children) {
        child.meta = { ...child.meta, mdmarkNoTerms: true };
      }
    }
  }
  const tokens = parsed;
  const keys = mixed.map((key) => `\`${key}\``).join("\u30FB");
  return mixed.length === 0 ? { tokens } : {
    tokens,
    warning: `\u306F \`alias_row\` \u3068 ${keys} \u3092\u4E00\u7DD2\u306B\u8A18\u8F09\u3057\u3066\u3044\u307E\u3059\u3002\`alias_row\` \u3092\u4F7F\u7528\u3059\u308B\u3068\u304D\u306F ${keys} \u3092\u524A\u9664\u3057\u3066\u304F\u3060\u3055\u3044\u3002\`alias_row\` \u306E\u884C\u306E\u7528\u8A9E\u3067\u8868\u3092\u63CF\u3044\u3066\u3044\u307E\u3059\u3002`
  };
}
function aliasGlossary(state, token, mark) {
  const { tokens, warning } = aliasGlossaryTokens({
    options: mark.options,
    mark: mark.raw,
    state
  });
  for (const item of tokens) {
    item.map = token.map;
    item.level += token.level;
  }
  const out = [];
  if (warning !== void 0) {
    out.push(warningBlock(state, { mark: mark.raw, message: warning }, token));
  }
  if (tokens.length > 0) {
    const [open, close] = tableMarkTokens(state, token);
    out.push(open, ...tokens, close);
  }
  return out;
}
function glossaryRule(state) {
  const enabled = featureOn(state, "glossary");
  const tokens = state.tokens;
  const out = [];
  for (let position = 0; position < tokens.length; position++) {
    const token = tokens[position];
    const mark = markOf(token);
    if (!token || mark?.name !== "glossary") {
      if (token) {
        out.push(token);
      }
      continue;
    }
    if (mark.closing) {
      continue;
    }
    if (Object.hasOwn(mark.options, "alias_row")) {
      out.push(...aliasGlossary(state, token, mark));
      continue;
    }
    const close = findClose(tokens, position, "glossary");
    const end = close === -1 ? tokens.length : close;
    const range = tokens.slice(position + 1, end);
    if (enabled) {
      out.push(
        ...collectGlossary(state, {
          token,
          mark,
          tokens: range,
          closed: close !== -1
        })
      );
    }
    out.push(...range);
    position = end;
  }
  state.tokens = out;
}

// src/knowledge/references.ts
var FRONTMATTER_KEYS = ["title", "description", "aliases", "tags"];
function isFilledString(value) {
  return typeof value === "string" && value !== "";
}
function readFrontmatterMetadata(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const record = value;
  const metadata = {};
  if (isFilledString(record.title)) {
    metadata.title = record.title;
  }
  if (isFilledString(record.description)) {
    metadata.description = record.description;
  }
  const { aliases, tags } = record;
  if (Array.isArray(aliases) && aliases.every(isFilledString)) {
    metadata.aliases = aliases;
  }
  if (Array.isArray(tags) && normalizeIndex({ schema: 2, docs: [{ id: "_", path: "_", tags }] }).problems.length === 0) {
    metadata.tags = tags;
  }
  return metadata;
}
function firstHeading(markdown) {
  let fence2;
  for (const line of splitFrontmatter(markdown).body.split("\n")) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1].charAt(0);
      fence2 = fence2 === void 0 ? marker : fence2 === marker ? void 0 : fence2;
      continue;
    }
    if (fence2 !== void 0) {
      continue;
    }
    const heading2 = /^ {0,3}#\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (heading2?.[1]) {
      return heading2[1];
    }
  }
  return void 0;
}
function resolveDocTitle(doc) {
  return doc.indexTitle ?? doc.frontmatterTitle ?? firstHeading(doc.markdown) ?? fileTitle(doc.path);
}
function supplementIndexDocs(input) {
  const bodies = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath2(path),
      body
    ])
  );
  const metadata = new Map(
    Object.entries(input.frontmatter ?? {}).map(([path, value]) => [
      normalizePath2(path),
      readFrontmatterMetadata(value)
    ])
  );
  const docs = input.index.docs.map((doc) => {
    const path = normalizePath2(doc.path);
    const found = metadata.get(path) ?? {};
    const filled = { ...doc };
    for (const key of FRONTMATTER_KEYS) {
      if (filled[key] === void 0 && found[key] !== void 0) {
        Object.assign(filled, { [key]: found[key] });
      }
    }
    filled.title ??= resolveDocTitle({
      path: doc.path,
      markdown: bodies.get(path) ?? ""
    });
    return filled;
  });
  const indexedPaths = new Set(docs.map((doc) => normalizePath2(doc.path)));
  const ids = new Set(docs.map((doc) => doc.id));
  const added = /* @__PURE__ */ new Set();
  for (const path of bodies.keys()) {
    const found = metadata.get(path);
    if (found?.title === void 0 || indexedPaths.has(path) || ids.has(path)) {
      continue;
    }
    docs.push({ id: path, path, ...found, title: found.title });
    added.add(path);
  }
  return { docs, added, metadata };
}
var parser;
function parseDocument3(options) {
  if (!parser) {
    parser = new MarkdownItCallable({ html: true });
    parser.core.ruler.push("mdmark_take_marks", takeMarks);
    parser.core.ruler.push("mdmark_resolve_features", resolveDocumentFeatures);
    parser.core.ruler.push("mdmark_glossary", glossaryRule);
  }
  const env = {
    libraries: {},
    defaults: options.defaults,
    featureOptions: [],
    markNotes: [],
    features: {},
    headings: [],
    nonce: "",
    docId: options.docId,
    ownGlossary: [],
    glossaryLines: []
  };
  const tokens = parser.parse(splitFrontmatter(options.body).body, env);
  const glossary = env.ownGlossary.map((entry, position) => ({
    entry,
    line: env.glossaryLines?.[position] ?? 0
  }));
  return { tokens, features: env.features, glossary };
}

// src/knowledge/matches.ts
function wordEnd(options) {
  const { body, offsets } = options;
  const previous = offsets[options.end - 1];
  let end = offsets[options.end];
  while (end > previous + 1 && body[end - 1] === "\r") {
    end -= 1;
  }
  return end;
}
function lineStartsOf(body) {
  const starts = [0];
  for (let at = body.indexOf("\n"); at >= 0; at = body.indexOf("\n", at + 1)) {
    starts.push(at + 1);
  }
  return starts;
}
function lineIndexOf(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (lineStarts[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}
function markedRanges(tokens, accept) {
  const ranges = [];
  for (let index = 0; index < tokens.length; index++) {
    const mark = markOf(tokens[index]);
    if (!mark || mark.closing || !accept(mark.name)) {
      continue;
    }
    const closeIndex = findClose(tokens, index, mark.name);
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    ranges.push(tokens.slice(index + 1, end));
    index = end;
  }
  return ranges;
}
function fenceRange(options) {
  const { fence: fence2, body, lineStarts } = options;
  const [first, last] = fence2.map ?? [];
  if (first === void 0 || last === void 0) {
    return void 0;
  }
  const lines = body.split("\n");
  const closed = last - 1 > first && (lines[last - 1] ?? "").trim().startsWith(fence2.markup);
  return {
    from: lineStarts[first + 1] ?? body.length,
    to: (closed ? lineStarts[last - 1] : lineStarts[last]) ?? body.length
  };
}
function singleFenceRange(options) {
  const { range, isFence, body, lineStarts } = options;
  const fences = range.filter(isFence);
  const [fence2] = fences;
  if (fences.length !== 1 || fence2 === void 0) {
    return void 0;
  }
  const span = fenceRange({ fence: fence2, body, lineStarts });
  return span === void 0 ? void 0 : { ...span, fence: fence2 };
}
function embeddedHtmlMatches(options) {
  const { body, tokens, dictionary } = options;
  if (dictionary.words.length === 0) {
    return [];
  }
  const lineStarts = lineStartsOf(body);
  const found = [];
  for (const range of markedRanges(tokens, (name) => name === "html")) {
    const block2 = singleFenceRange({
      range,
      isFence: isHtmlFence,
      body,
      lineStarts
    });
    if (block2 === void 0) {
      continue;
    }
    const source = block2.fence.content.replace(PART_PATTERN, "");
    const masked = maskEmbeddedHtml(body.slice(block2.from, block2.to));
    let open = "\uE000";
    while (source.includes(open)) {
      open += "\uE000";
    }
    const close = "\uE001";
    const pieces = [];
    const sanitized = sanitizeEmbedded(source, (text2) => {
      pieces.push(text2);
      return `${open}${pieces.length - 1}${close}`;
    });
    const kept = new Set(
      [...sanitized.matchAll(new RegExp(`${open}(\\d+)${close}`, "g"))].map(
        (match) => Number(match[1])
      )
    );
    let cursor = 0;
    pieces.forEach((piece, position) => {
      if (!kept.has(position)) {
        return;
      }
      const text2 = unescapeHtml(piece);
      const aligned = alignText({ body: masked, cursor, text: text2 });
      cursor = aligned.end;
      for (const word of findWords(text2, dictionary.words)) {
        found.push({
          word: dictionary.written.get(word.word) ?? word.word,
          key: word.word,
          offset: block2.from + aligned.offsets[word.start],
          end: block2.from + wordEnd({ body: masked, offsets: aligned.offsets, end: word.end })
        });
      }
    });
  }
  return found;
}
var JSON_SIMPLE_ESCAPES = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "	"
};
function decodeJsonChar(raw, position) {
  const char = raw[position];
  if (char !== "\\") {
    return { decoded: char, length: 1 };
  }
  const next = raw[position + 1] ?? "";
  const hex = raw.slice(position + 2, position + 6);
  if (next === "u" && /^[0-9a-fA-F]{4}$/.test(hex)) {
    return {
      decoded: String.fromCharCode(Number.parseInt(hex, 16)),
      length: 6
    };
  }
  return { decoded: JSON_SIMPLE_ESCAPES[next] ?? next, length: 2 };
}
function readJsonString(raw, from) {
  let text2 = "";
  const starts = [];
  const ends = [];
  let position = from;
  while (position < raw.length && raw[position] !== '"') {
    const { decoded, length } = decodeJsonChar(raw, position);
    text2 += decoded;
    for (let count = 0; count < decoded.length; count++) {
      starts.push(position);
      ends.push(position + length);
    }
    position += length;
  }
  return {
    string: { text: text2, starts, ends },
    closed: position < raw.length,
    end: position
  };
}
function jsonStrings(raw) {
  const strings = [];
  let at = 0;
  while (at < raw.length) {
    if (raw[at] !== '"') {
      at += 1;
      continue;
    }
    const read = readJsonString(raw, at + 1);
    if (read.closed) {
      strings.push(read.string);
    }
    at = read.end + 1;
  }
  return strings;
}
function definitionTerms(options) {
  const { raw, base: base2, dictionary } = options;
  const found = [];
  for (const string2 of jsonStrings(raw)) {
    for (const match of string2.text.matchAll(/\{\{(.+?)\}\}/g)) {
      const word = match[1];
      const meaning = dictionary.term(word)?.meaning;
      if (meaning === void 0 || meaning === "") {
        continue;
      }
      const first = match.index + 2;
      const last = first + word.length - 1;
      found.push({
        word: dictionary.written.get(normalizeWord(word)) ?? word,
        key: normalizeWord(word),
        offset: base2 + string2.starts[first],
        end: base2 + string2.ends[last],
        termOnly: true
      });
    }
  }
  return found;
}
function diagramTermMatches(options) {
  const { body, tokens, dictionary, html } = options;
  if (dictionary.words.length === 0) {
    return [];
  }
  const lineStarts = lineStartsOf(body);
  const found = [];
  const directives = (name) => Object.hasOwn(DIAGRAM_DIRECTIVES, name);
  for (const range of markedRanges(tokens, directives)) {
    const block2 = singleFenceRange({
      range,
      isFence: (token) => jsonFences([token]).length === 1,
      body,
      lineStarts
    });
    if (block2 !== void 0) {
      found.push(
        ...definitionTerms({
          raw: body.slice(block2.from, block2.to),
          base: block2.from,
          dictionary
        })
      );
    }
  }
  if (!html) {
    return found;
  }
  for (const range of markedRanges(tokens, (name) => name === "html")) {
    const block2 = singleFenceRange({
      range,
      isFence: isHtmlFence,
      body,
      lineStarts
    });
    if (block2 === void 0) {
      continue;
    }
    const source = body.slice(block2.from, block2.to);
    for (const part of source.matchAll(new RegExp(PART_PATTERN))) {
      if (isRetiredDiagram(part[1].toLowerCase())) {
        continue;
      }
      const definition = part[2];
      found.push(
        ...definitionTerms({
          raw: definition,
          base: block2.from + part.index + part[0].indexOf(">") + 1,
          dictionary
        })
      );
    }
  }
  return found;
}
var FLOW_LABEL = /\(\[([^\]]*)\]\)|\[\(([^)]*)\)\]|\[\[([^\]]*)\]\]|\(\(([^)]*)\)\)|\{\{([^}]*)\}\}|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\|([^|]*)\|/g;
var FLOW_SKIPPED = /^\s*(classDef|class|style|linkStyle|click|accTitle|accDescr|%%)\b/;
var SEQUENCE_KEYWORDS = /^\s*(loop|alt|else|opt|par|and|critical|option|break|rect|end|autonumber|activate|deactivate|box|%%)\b/;
function mermaidTexts(line, kind) {
  if (kind === "flowchart") {
    if (FLOW_SKIPPED.test(line)) {
      return [];
    }
    return [...line.matchAll(FLOW_LABEL)].flatMap((match) => {
      const index = match.slice(1).findIndex((group) => group !== void 0);
      const text2 = match[index + 1];
      const open = match[0].indexOf(text2);
      return [{ start: match.index + open, text: text2 }];
    });
  }
  const declared = /^(\s*(?:participant|actor)\s+\S+\s+as\s+)(.*)$/.exec(line);
  if (declared) {
    return [
      { start: declared[1].length, text: declared[2] }
    ];
  }
  if (SEQUENCE_KEYWORDS.test(line)) {
    return [];
  }
  const colon = line.indexOf(":");
  return colon < 0 ? [] : [{ start: colon + 1, text: line.slice(colon + 1) }];
}
function mapDiagramKind(lines) {
  const head = lines.find((line) => line.trim() !== "")?.trim() ?? "";
  if (/^(flowchart|graph)\b/.test(head)) {
    return "flowchart";
  }
  return /^sequenceDiagram\b/.test(head) ? "sequence" : void 0;
}
function termOnlyMatches(options) {
  const { text: text2, offset, dictionary } = options;
  return findWords(text2, dictionary.words).flatMap((word) => {
    const meaning = dictionary.term(word.word)?.meaning;
    if (meaning === void 0 || meaning === "") {
      return [];
    }
    const key = normalizeWord(word.word);
    return [
      {
        word: dictionary.written.get(key) ?? word.word,
        key,
        offset: offset + word.start,
        end: offset + word.end,
        termOnly: true
      }
    ];
  });
}
function mapBlockMatches(options) {
  const { source, from, dictionary } = options;
  const lines = source.split("\n");
  const kind = mapDiagramKind(lines);
  if (kind === void 0) {
    return [];
  }
  const found = [];
  let lineStart = from;
  for (const line of lines) {
    for (const { start, text: text2 } of mermaidTexts(line, kind)) {
      found.push(
        ...termOnlyMatches({ text: text2, offset: lineStart + start, dictionary })
      );
    }
    lineStart += line.length + 1;
  }
  return found;
}
function mapTermMatches(options) {
  const { body, tokens, dictionary } = options;
  if (dictionary.words.length === 0) {
    return [];
  }
  const lineStarts = lineStartsOf(body);
  const found = [];
  for (const range of markedRanges(tokens, (name) => name === "map")) {
    const block2 = singleFenceRange({
      range,
      isFence: (token) => token.type === "fence" && token.info.trim().split(/\s+/)[0] === "mermaid",
      body,
      lineStarts
    });
    if (block2 !== void 0) {
      found.push(
        ...mapBlockMatches({
          source: body.slice(block2.from, block2.to),
          from: block2.from,
          dictionary
        })
      );
    }
  }
  return found;
}
function wordMatches(options) {
  const { content, offsets, body, dictionary } = options;
  return findWords(content, dictionary.words).map((word) => ({
    word: dictionary.written.get(word.word) ?? word.word,
    key: word.word,
    offset: offsets[word.start],
    end: wordEnd({ body, offsets, end: word.end })
  }));
}
function paragraphMatches(options) {
  const { body, tokens, dictionary, lineStarts } = options;
  const found = [];
  let previous;
  forEachInline(tokens, (inline2) => {
    const line = inline2.map?.[0] ?? 0;
    const start = previous?.line === line ? previous.end : lineStarts[line] ?? 0;
    const aligned = inlineOffsets({ body, inline: inline2, start });
    previous = { line, end: aligned.end };
    for (const [position, offsets] of aligned.byChild) {
      const content = inline2.children?.[position]?.content ?? "";
      found.push(...wordMatches({ content, offsets, body, dictionary }));
    }
  });
  return found;
}
function locate(options) {
  const { found, lineStarts } = options;
  const lineIndex = lineIndexOf(lineStarts, found.offset);
  const lineStart = lineStarts[lineIndex];
  return {
    text: found.word,
    line: lineIndex + 1,
    start: found.offset - lineStart,
    end: found.end - lineStart
  };
}
function avoidedFound(options) {
  const { body, tokens, dictionary, lineStarts, html } = options;
  const withAvoided = {
    ...dictionary,
    words: [.../* @__PURE__ */ new Set([...dictionary.words, ...dictionary.avoided.keys()])]
  };
  const found = paragraphMatches({
    body,
    tokens,
    dictionary: withAvoided,
    lineStarts
  });
  if (html) {
    found.push(
      ...embeddedHtmlMatches({ body, tokens, dictionary: withAvoided })
    );
  }
  return found.filter(({ key }) => dictionary.avoided.has(key));
}
function aliasTarget(alias) {
  return {
    kind: "alias",
    aliasType: alias.alias_type,
    id: alias.id,
    title: alias.name,
    ...alias.description === void 0 ? {} : { description: alias.description }
  };
}
function termTargetsOf(glossary, terms) {
  const targets = /* @__PURE__ */ new Map();
  for (const entry of glossary) {
    const id = `glossary:${entry.docId}:${entry.term}`;
    targets.set(id, {
      kind: "glossary",
      id,
      title: entry.term,
      description: entry.meaning
    });
  }
  for (const term of terms ?? []) {
    targets.set(term.id, {
      kind: "term",
      id: term.id,
      title: term.term,
      description: term.meaning
    });
  }
  return targets;
}
function documentFound(options) {
  const { body, parsed, dictionary, lineStarts } = options;
  if (dictionary.words.length === 0) {
    return [];
  }
  const { tokens, features } = parsed;
  const html = features.html === true;
  const found = [
    ...paragraphMatches({ body, tokens, dictionary, lineStarts }),
    ...html ? embeddedHtmlMatches({ body, tokens, dictionary }) : [],
    ...features.diagrams === true ? diagramTermMatches({ body, tokens, dictionary, html }) : [],
    ...features.map === true ? mapTermMatches({ body, tokens, dictionary }) : []
  ];
  return found.sort((a, b) => a.offset - b.offset);
}
function referencedOf(options) {
  const { item, dictionary, termTargets } = options;
  const term = dictionary.terms.get(item.key);
  const termTarget = term?.alias === void 0 ? term && termTargets.get(term.id) : aliasTarget(term.alias);
  const docs = item.termOnly ? [] : dictionary.docs.get(item.key) ?? [];
  return [
    ...termTarget === void 0 ? [] : [termTarget],
    ...docs.map(
      (target) => ({
        kind: "doc",
        id: target.id,
        title: target.title ?? fileTitle(target.path),
        ...target.description === void 0 ? {} : { description: target.description }
      })
    )
  ];
}
function avoidedTargetOf(replacement, termTargets) {
  if (replacement === void 0) {
    return void 0;
  }
  if (replacement.alias === void 0) {
    return termTargets.get(replacement.id);
  }
  return {
    kind: "alias",
    aliasType: replacement.alias.alias_type,
    id: replacement.alias.id,
    title: replacement.term,
    ...replacement.meaning === void 0 ? {} : { description: replacement.meaning }
  };
}
function avoidedMatchesOf(options) {
  const { body, parsed, dictionary, lineStarts, termTargets } = options;
  if (dictionary.avoided.size === 0) {
    return [];
  }
  const foundAvoided = avoidedFound({
    body,
    tokens: parsed.tokens,
    dictionary,
    lineStarts,
    html: parsed.features.html === true
  }).sort((a, b) => a.offset - b.offset);
  return foundAvoided.flatMap((item) => {
    const target = avoidedTargetOf(
      dictionary.avoided.get(item.key),
      termTargets
    );
    return target === void 0 ? [] : [{ ...target, ...locate({ found: item, lineStarts }) }];
  });
}
function collectMatches(input) {
  const normalized = normalizeIndex(input.index).index;
  const index = {
    ...normalized,
    docs: supplementIndexDocs({
      index: normalized,
      documents: input.documents,
      frontmatter: input.frontmatter
    }).docs
  };
  const defaults = resolveConfig({ config: input.config }).features;
  const bodies = new Map(
    Object.entries(input.documents).map(([path, body]) => [
      normalizePath2(path),
      body
    ])
  );
  const scanned = index.docs.flatMap((doc) => {
    const body = bodies.get(normalizePath2(doc.path));
    return body === void 0 ? [] : [
      {
        doc,
        body,
        parsed: parseDocument3({ body, docId: doc.id, defaults })
      }
    ];
  });
  const glossary = scanned.flatMap(
    (item) => item.parsed.glossary.map((row) => row.entry)
  );
  const termTargets = termTargetsOf(glossary, index.terms);
  const byDocument = {};
  const avoided = {};
  const targets = /* @__PURE__ */ new Map();
  for (const { doc, body, parsed } of scanned) {
    const dictionary = buildDictionary({
      index,
      docId: doc.id,
      ownGlossary: parsed.glossary.map((row) => row.entry),
      references: { backlinks: {}, glossary },
      aliases: input.aliases,
      features: parsed.features
    });
    const lineStarts = lineStartsOf(body);
    const matches2 = [];
    for (const item of documentFound({
      body,
      parsed,
      dictionary,
      lineStarts
    })) {
      const position = locate({ found: item, lineStarts });
      for (const target of referencedOf({ item, dictionary, termTargets })) {
        matches2.push({ ...target, ...position });
        targets.set(`${target.kind}\0${target.id}`, target);
      }
    }
    byDocument[doc.id] = matches2;
    avoided[doc.id] = avoidedMatchesOf({
      body,
      parsed,
      dictionary,
      lineStarts,
      termTargets
    });
  }
  return { byDocument, avoided, targets: [...targets.values()] };
}

// src/mdmark-style/terms.ts
var MESSAGE_DOC = {
  id: "mdmark-style:message",
  path: "mdmark-style:message.md"
};
var GlossaryError = class extends Error {
  name = "GlossaryError";
};
var MD2 = new MarkdownItCallable({ html: true });
var INLINE_EXCLUDED = /`[^`]*`|!?\[[^\]]*\]\([^)]*\)|<[a-z][\w+.-]*:[^>]*>/gi;
async function readYaml($, path) {
  let text2;
  try {
    text2 = await $.fs.read(path);
  } catch (error2) {
    const reason = error2 instanceof Error ? error2.message : String(error2);
    throw new GlossaryError(
      `mdmark-style \u306E\u7528\u8A9E\u96C6\u3092\u8AAD\u3081\u306A\u3044: ${path}\uFF08${reason}\uFF09`
    );
  }
  try {
    return parse(text2);
  } catch (error2) {
    const reason = error2 instanceof Error ? error2.message.split("\n")[0] : "";
    throw new GlossaryError(
      `mdmark-style \u306E\u7528\u8A9E\u96C6\u3092\u8AAD\u3081\u306A\u3044: ${path}\uFF08${reason}\uFF09`
    );
  }
}
var globToRegExp = (glob) => {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] ?? "";
    if (char === "*" && glob[i + 1] === "*") {
      source += ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
};
async function listFiles($, dir, prefix = "") {
  const entries = await $.fs.list(prefix === "" ? dir : `${dir}/${prefix}`);
  const files = [];
  for (const entry of entries) {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.kind === "dir") {
      files.push(...await listFiles($, dir, relative));
    } else if (entry.kind === "file") {
      files.push(relative);
    }
  }
  return files;
}
async function loadAliases($, options) {
  const { rows, configDir } = options;
  const sources = [];
  let files;
  for (const row of rows) {
    if (typeof row !== "object" || row === null) {
      continue;
    }
    const { id, paths } = row;
    if (typeof id !== "string" || !Array.isArray(paths)) {
      continue;
    }
    const patterns = paths.filter((path) => typeof path === "string").map(globToRegExp);
    files ??= await listFiles($, configDir);
    for (const file of files.filter(
      (path) => patterns.some((re) => re.test(path))
    )) {
      try {
        sources.push({
          rowId: id,
          path: file,
          data: parse(await $.fs.read(joinPath(configDir, file)))
        });
      } catch {
      }
    }
  }
  return buildAliases({ rows, sources }).aliases;
}
async function loadGlossary($, options) {
  const { configPath } = options;
  const raw = await readYaml($, configPath);
  const config2 = typeof raw === "object" && raw !== null ? raw : {};
  const configDir = dirOf(configPath);
  if (typeof config2.index !== "string") {
    throw new GlossaryError(
      `mdmark-style \u306E\u7528\u8A9E\u96C6\u3092\u8AAD\u3081\u306A\u3044: ${configPath}\uFF08index \u304C\u3042\u308A\u307E\u305B\u3093\uFF09`
    );
  }
  const indexPath = joinPath(configDir, config2.index);
  const index = await readYaml($, indexPath);
  const indexDir = dirOf(indexPath);
  const documents = {};
  for (const doc of index.docs ?? []) {
    try {
      documents[doc.path] = await $.fs.read(joinPath(indexDir, doc.path));
    } catch {
    }
  }
  const aliases = Array.isArray(config2.aliases) ? await loadAliases($, { rows: config2.aliases, configDir }) : [];
  return { index, documents, config: config2, aliases };
}
var excludedLines = (text2) => {
  const lines = /* @__PURE__ */ new Set();
  for (const token of MD2.parse(text2, {})) {
    const whole = token.type === "heading_open" || token.type === "table_open" || token.type === "fence" || token.type === "code_block" || token.type === "html_block";
    if (whole && token.map !== null && token.level === 0) {
      for (let line = token.map[0]; line < token.map[1]; line += 1) {
        lines.add(line + 1);
      }
    }
  }
  return lines;
};
var insideInline = (options) => {
  for (const match of options.line.matchAll(INLINE_EXCLUDED)) {
    const from = match.index;
    if (options.start < from + match[0].length && options.end > from) {
      return true;
    }
  }
  return false;
};
var matchTerms = (options) => {
  const { glossary, text: text2 } = options;
  const matches2 = collectMatches({
    index: {
      ...glossary.index,
      docs: [...glossary.index.docs, { ...MESSAGE_DOC, title: MESSAGE_DOC.id }]
    },
    documents: { ...glossary.documents, [MESSAGE_DOC.path]: text2 },
    config: glossary.config,
    aliases: glossary.aliases
  });
  const lines = text2.split("\n");
  const excluded = excludedLines(text2);
  const seen = /* @__PURE__ */ new Set();
  const marks = [];
  const found = [...matches2.byDocument[MESSAGE_DOC.id] ?? []].sort(
    (a, b) => a.line - b.line || a.start - b.start
  );
  for (const match of found) {
    const key = `${match.kind}\0${match.id}`;
    const line = lines[match.line - 1] ?? "";
    if (match.kind === "doc" || seen.has(key) || excluded.has(match.line) || insideInline({ line, start: match.start, end: match.end })) {
      continue;
    }
    seen.add(key);
    marks.push({
      line: match.line,
      start: match.start,
      end: match.end,
      title: match.title,
      description: match.description ?? "",
      footnote: marks.length + 1
    });
  }
  return marks;
};

// src/mdmark-style/user-message.tsx
var CARD_MAX_WIDTH = 48;
var PROMPT_MARK_COLOR = "#949494";
var styledChars = (line) => {
  const chars = [];
  let bold = false;
  let i = 0;
  while (i < line.length) {
    if (line.startsWith("**", i)) {
      bold = !bold;
      i += 2;
      continue;
    }
    const code2 = /^`([^`]*)`/.exec(line.slice(i));
    if (code2?.[1] !== void 0) {
      for (const [offset, char] of [...code2[1]].entries()) {
        chars.push({ char, at: i + 1 + offset, bold, code: true, link: false });
      }
      i += code2[0].length;
      continue;
    }
    const link2 = /^\[([^\]]*)\]\([^)]*\)/.exec(line.slice(i));
    if (link2?.[1] !== void 0) {
      for (const [offset, char] of [...link2[1]].entries()) {
        chars.push({ char, at: i + 1 + offset, bold, code: false, link: true });
      }
      i += link2[0].length;
      continue;
    }
    chars.push({ char: line[i] ?? "", at: i, bold, code: false, link: false });
    i += 1;
  }
  return chars;
};
var termNode = (options) => {
  const { elements, mark, text: text2, parts, theme, width } = options;
  const { Box, Text: Text3 } = elements;
  const cardWidth = Math.min(CARD_MAX_WIDTH, width ?? CARD_MAX_WIDTH);
  const card = h(
    Box,
    {
      position: "absolute",
      top: 1,
      left: 0,
      display: "none",
      hover: { display: "flex" },
      flexDirection: "column",
      borderStyle: "round",
      borderColor: styleColor({ name: "border", theme }),
      backgroundColor: styleColor({ name: "codeBackground", theme }),
      width: cardWidth
    },
    h(Text3, { bold: true }, mark.title),
    h(Text3, null, mark.description)
  );
  return h(
    Box,
    { key: `term-${mark.footnote}-${mark.line}-${mark.start}` },
    h(
      Text3,
      { underline: true, color: styleColor({ name: "termUnderline", theme }) },
      text2
    ),
    parts.footnote ? h(Text3, { dimColor: true }, `[${mark.footnote}]`) : void 0,
    parts.hover_card ? card : void 0
  );
};
var styleProps = (char, theme) => ({
  ...char.bold ? { bold: true } : {},
  ...char.code ? { color: styleColor({ name: "heading", theme }), mono: true } : {},
  ...char.link ? { underline: true } : {}
});
var ACCENT_COLORS = {
  blue: { bg: "accentBlueBg", text: "accentBlueText" },
  red: { bg: "accentRedBg", text: "accentRedText" },
  green: { bg: "accentGreenBg", text: "accentGreenText" },
  yellow: { bg: "accentYellowBg", text: "accentYellowText" },
  orange: { bg: "accentOrangeBg", text: "accentOrangeText" },
  purple: { bg: "accentPurpleBg", text: "accentPurpleText" },
  gray: { bg: "accentGrayBg", text: "accentGrayText" }
};
var inlineNodes = (options) => {
  const { elements, segment, theme } = options;
  const { Text: Text3 } = elements;
  const color = (name) => styleColor({ name, theme });
  const accent = segment.color === void 0 ? void 0 : ACCENT_COLORS[segment.color];
  const key = `inline-${segment.start}`;
  switch (segment.kind) {
    case "badge":
      return [
        h(
          Text3,
          {
            key,
            backgroundColor: color(accent?.bg ?? "surface"),
            color: color(accent?.text ?? "text")
          },
          ` ${segment.text} `
        )
      ];
    case "color":
      return [
        h(
          Text3,
          { key, bold: true, color: color(accent?.text ?? "text") },
          segment.text
        )
      ];
    case "highlight":
      return [
        h(
          Text3,
          { key, backgroundColor: color(accent?.bg ?? "accentYellowBg") },
          segment.text
        )
      ];
    case "kbd":
      return (segment.keys ?? []).flatMap((name, index) => [
        index === 0 ? void 0 : h(Text3, { key: `${key}-join-${index}`, dimColor: true }, "+"),
        h(Text3, { key: `${key}-key-${index}`, bold: true }, `[${name}]`)
      ]);
    case "text":
      return [];
    default: {
      const unreachable = segment.kind;
      return unreachable;
    }
  }
};
var textRuns = (options) => {
  const { elements, segment, marks, parts, theme, width, base: base2 } = options;
  const { Text: Text3 } = elements;
  const markOf2 = (at) => marks.find((mark) => at >= mark.start && at < mark.end);
  const runs = [];
  for (const raw of styledChars(segment.text)) {
    const char = { ...raw, at: raw.at + segment.start };
    const mark = markOf2(char.at);
    const last = runs.at(-1);
    const same = last !== void 0 && last.mark === mark && last.char.bold === char.bold && last.char.code === char.code && last.char.link === char.link;
    if (same) {
      last.text += char.char;
    } else {
      runs.push({ text: char.char, char, mark });
    }
  }
  return runs.map(
    (run) => run.mark === void 0 ? h(Text3, { ...base2, ...styleProps(run.char, theme) }, run.text) : termNode({
      elements,
      mark: run.mark,
      text: run.text,
      parts,
      theme,
      width
    })
  );
};
var renderTermText = (options) => {
  const { elements, line, marks, parts, theme, width, base: base2 = {} } = options;
  const segments = parts.inline ? splitInlineMarks(line) : [{ kind: "text", text: line, start: 0 }];
  const nodes = segments.flatMap(
    (segment) => segment.kind === "text" ? textRuns({ elements, segment, marks, parts, theme, width, base: base2 }) : inlineNodes({ elements, segment, theme })
  );
  return h(elements.Box, { flexDirection: "row", flexWrap: "wrap" }, ...nodes);
};
var renderFootnotes2 = (options) => options.marks.map(
  (mark) => h(
    options.elements.Text,
    { key: `footnote-${mark.footnote}`, dimColor: true },
    `[${mark.footnote}] ${mark.title}: ${mark.description}`
  )
);
async function termMarksOf($, options) {
  const { settings, text: text2 } = options;
  if (!settings.parts.terms || settings.glossary === void 0) {
    return [];
  }
  try {
    const glossary = await loadGlossary($, { configPath: settings.glossary });
    return matchTerms({ glossary, text: text2 });
  } catch (error2) {
    if (!(error2 instanceof GlossaryError)) {
      throw error2;
    }
    $.ui.log(error2.message, { to: "debug" });
    return [];
  }
}
async function renderUserMessage($, e, next) {
  let settings;
  try {
    settings = await readSettings($);
  } catch (error2) {
    if (!(error2 instanceof SettingsError)) {
      throw error2;
    }
    $.ui.log(error2.message, { to: "debug" });
    return next(e);
  }
  if (!settings.enabled || !settings.targets.includes("user") || !settings.parts.terms || settings.glossary === void 0 || e.props.origin?.kind !== "composer") {
    return next(e);
  }
  const text2 = e.props.text;
  const marks = await termMarksOf($, { settings, text: text2 });
  if (marks.length === 0) {
    return next(e);
  }
  const elements = $.ui.resolve(e);
  const { Box, Text: Text3 } = elements;
  const theme = await $.settings.read({ key: "theme" });
  const width = e.viewport?.columns;
  const lines = text2.split("\n").map(
    (line, index) => renderTermText({
      elements,
      line,
      marks: marks.filter((mark) => mark.line === index + 1),
      parts: { ...settings.parts, inline: false },
      theme,
      ...width === void 0 ? {} : { width }
    })
  );
  return h(
    Box,
    {
      flexDirection: "column",
      backgroundColor: styleColor({ name: "userBand", theme })
    },
    h(
      Box,
      { flexDirection: "row" },
      h(Text3, { color: PROMPT_MARK_COLOR }, "\u276F "),
      h(Box, { flexDirection: "column" }, ...lines)
    ),
    ...settings.parts.footnote ? renderFootnotes2({ elements, marks }) : []
  );
}

// src/mdmark-style/reply.tsx
var TREE_LIMITS = { nodes: 2e4, depth: 32, chars: 1e5 };
var foldStates = /* @__PURE__ */ new Map();
var CALLOUT_COLORS = {
  NOTE: "calloutNote",
  TIP: "calloutTip",
  IMPORTANT: "calloutImportant",
  WARNING: "calloutWarning",
  CAUTION: "calloutCaution"
};
var CODE_MARK_STYLES = {
  "++": { prefix: "+", color: "#3fb950" },
  "--": { prefix: "-", color: "#f85149" },
  highlight: { prefix: "\u258D", color: "#d29922" },
  focus: { prefix: "\u258D", color: "#58a6ff" },
  error: { prefix: "\u2715", color: "#f85149" },
  warning: { prefix: "!", color: "#d29922" }
};
var hashText = (text2) => {
  let hash = 2166136261;
  for (let i = 0; i < text2.length; i += 1) {
    hash ^= text2.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16);
};
var renderFold = (options) => {
  const { key, title, body, context } = options;
  const { Box, Button } = context.elements;
  const open = foldStates.get(key) ?? false;
  const toggle = () => {
    foldStates.set(key, !(foldStates.get(key) ?? false));
    context.ui.invalidate("ui.render");
  };
  return h(
    Box,
    { key, flexDirection: "column" },
    h(Button, {
      key: `${key}:button`,
      label: `${open ? "\u25BE" : "\u25B8"} ${title}`,
      onPress: toggle
    }),
    open ? body() : void 0
  );
};
var ruleLine = (widths, [left, middle, right]) => `${left}${widths.map((width) => "\u2500".repeat(width + 2)).join(middle)}${right}`;
var rowLines = (options) => {
  const { cells, widths, wrap } = options;
  const wrapped = widths.map((width, index) => {
    const text2 = cells[index] ?? "";
    return wrap ? wrapCell({ text: text2, width }) : [text2];
  });
  const height = Math.max(1, ...wrapped.map((lines) => lines.length));
  return Array.from(
    { length: height },
    (_, row) => wrapped.map((lines, index) => {
      const text2 = lines[row] ?? "";
      const pad = (widths[index] ?? 0) - displayWidth(text2);
      return `${text2}${" ".repeat(Math.max(0, pad))}`;
    })
  );
};
var ROW_TOGGLE_TEXT = "[ \u25B8 ] ";
var hasInline = (cell, context) => context.parts.inline && splitInlineMarks(cell).some((segment) => segment.kind !== "text");
var cellText = (cell, context) => context.parts.inline ? inlinePlainText(splitInlineMarks(cell)) : cell;
var renderTable2 = (block2, context) => {
  const table2 = block2.table;
  const { Box, Text: Text3 } = context.elements;
  if (table2 === void 0) {
    return void 0;
  }
  const detailRows = new Set((table2.details ?? []).map((detail) => detail.row));
  const shown = (row, rowIndex) => row.map((cell, index) => {
    const text2 = cellText(cell, context);
    return index === 0 && rowIndex !== void 0 && detailRows.has(rowIndex) ? `${ROW_TOGGLE_TEXT}${text2}` : text2;
  });
  const cells = [
    shown(table2.header, void 0),
    ...table2.rows.map((row, index) => shown(row, index))
  ];
  const wrap = context.surface !== "desktop";
  const widths = fitColumns({
    cells,
    ...context.columns === void 0 ? {} : { columns: context.columns },
    wrap
  });
  const border = styleColor({ name: "border", theme: context.theme });
  const cellNodes = (options) => {
    let rich = false;
    const nodes = options.columns.map((cell, index) => {
      const raw = options.raw?.[index];
      const toggle = index === 0 ? options.toggle : void 0;
      if (raw === void 0 && toggle !== void 0) {
        rich = true;
        const rest = cell.startsWith(ROW_TOGGLE_TEXT) ? cell.slice(ROW_TOGGLE_TEXT.length) : cell;
        return [
          toggle,
          h(Text3, null, " "),
          h(Text3, options.bold ? { bold: true } : null, rest)
        ];
      }
      if (raw === void 0 || toggle === void 0 && !hasInline(raw, context)) {
        return h(Text3, options.bold ? { bold: true } : null, cell);
      }
      rich = true;
      const drawn = `${toggle === void 0 ? "" : ROW_TOGGLE_TEXT}${cellText(raw, context)}`;
      const pad = " ".repeat(
        Math.max(0, (widths[index] ?? 0) - displayWidth(drawn))
      );
      return [
        toggle,
        toggle === void 0 ? void 0 : h(Text3, null, " "),
        renderTermText({
          elements: context.elements,
          line: raw,
          marks: [],
          parts: context.parts,
          theme: context.theme,
          ...options.bold ? { base: { bold: true } } : {}
        }),
        h(Text3, null, pad)
      ];
    });
    return { nodes, rich };
  };
  const lineNode = (key, columns, options) => {
    const { nodes, rich } = cellNodes({
      raw: options.raw,
      columns,
      bold: options.bold,
      toggle: options.toggle
    });
    const children = [
      h(Text3, { color: border }, "\u2502 "),
      ...nodes.flatMap((node, index) => [
        node,
        h(Text3, { color: border }, index === nodes.length - 1 ? " \u2502" : " \u2502 ")
      ])
    ];
    return rich ? h(Box, { key, flexDirection: "row" }, ...children) : h(Text3, { key }, ...children);
  };
  const rowNodes = (options) => {
    const lines2 = rowLines({ cells: options.shownCells, widths, wrap });
    const single = lines2.length === 1;
    return lines2.map(
      (columns, index) => lineNode(`${options.key}-${index}`, columns, {
        bold: options.bold,
        ...single ? { raw: options.raw } : {},
        ...index === 0 && options.toggle !== void 0 ? { toggle: options.toggle } : {}
      })
    );
  };
  const bold = table2.kind === "data";
  const bodyLines = table2.rows.flatMap((row, rowIndex) => {
    const detail = table2.details?.find((item) => item.row === rowIndex);
    if (detail === void 0) {
      return rowNodes({
        key: `row-${rowIndex}`,
        raw: row,
        shownCells: shown(row, rowIndex),
        bold: false
      });
    }
    const { toggle, detail: opened } = renderRowDetail({
      key: `${context.blockKey}:row-detail:${block2.line}:${rowIndex}`,
      body: () => h(
        Box,
        { flexDirection: "column" },
        ...detail.body.map((inner) => renderBlock({ block: inner, context }))
      ),
      context
    });
    return [
      ...rowNodes({
        key: `row-${rowIndex}`,
        raw: row,
        shownCells: shown(row, rowIndex),
        bold: false,
        toggle
      }),
      opened
    ];
  });
  const lines = [
    table2.figure === void 0 ? void 0 : h(Text3, { key: "figure", dimColor: true }, `\u8868 ${table2.figure}`),
    h(Text3, { key: "top", color: border }, ruleLine(widths, ["\u250C", "\u252C", "\u2510"])),
    ...rowNodes({
      key: "head",
      raw: table2.header,
      shownCells: shown(table2.header, void 0),
      bold
    }),
    h(Text3, { key: "sep", color: border }, ruleLine(widths, ["\u251C", "\u253C", "\u2524"])),
    ...bodyLines,
    h(
      Text3,
      { key: "bottom", color: border },
      ruleLine(widths, ["\u2514", "\u2534", "\u2518"])
    )
  ];
  const total = widths.reduce((sum, width) => sum + width, 0) + widths.length * 3 + 1;
  const scroll = context.surface === "desktop" && context.columns !== void 0 && total > context.columns;
  return h(
    Box,
    {
      key: `table-${block2.line}`,
      flexDirection: "column",
      ...scroll ? { overflowX: "scroll" } : {}
    },
    ...lines
  );
};
var renderCode = (block2, context) => {
  const code2 = block2.code;
  const { Box, Text: Text3, Button, Code } = context.elements;
  if (code2 === void 0) {
    return void 0;
  }
  const source = code2.lines.map((line) => line.text).join("\n");
  const head = [code2.title, code2.lang].filter((item) => item !== void 0 && item !== "").join("  ");
  const digits = String(code2.lines.length).length;
  return h(
    Box,
    {
      key: `code-${block2.line}`,
      flexDirection: "column",
      backgroundColor: styleColor({
        name: "codeBackground",
        theme: context.theme
      }),
      paddingX: 1
    },
    h(
      Box,
      { flexDirection: "row", justifyContent: "space-between" },
      h(Text3, { dimColor: true }, head),
      h(Button, {
        key: `${context.blockKey}:copy:${block2.line}`,
        label: "\u30B3\u30D4\u30FC",
        onPress: () => context.ui.copy({ text: source, surface: context.surface })
      })
    ),
    ...code2.lines.map((line, index) => {
      const style = line.mark === void 0 ? void 0 : CODE_MARK_STYLES[line.mark];
      return h(
        Box,
        { key: `line-${index}`, flexDirection: "row" },
        code2.lineNumbers ? h(
          Text3,
          { dimColor: true },
          `${String(index + 1).padStart(digits)} `
        ) : void 0,
        h(
          Text3,
          style === void 0 ? { dimColor: true } : { color: style.color },
          `${style?.prefix ?? " "} `
        ),
        h(Code, {
          source: line.text,
          ...code2.lang === "" ? {} : { language: code2.lang }
        })
      );
    })
  );
};
var markInLine = (mark, columns) => {
  if (columns === void 0) {
    return mark;
  }
  const start = columns.findIndex((column) => column >= mark.start);
  const end = columns.filter((column) => column < mark.end).length;
  return start < 0 || end <= start ? void 0 : { ...mark, start, end };
};
var marksByLine = (block2, lines, marks) => lines.map(
  (_line, index) => marks.filter((mark) => mark.line === block2.line + index).map((mark) => markInLine(mark, block2.columns?.[index])).filter((mark) => mark !== void 0)
);
var renderMarkdown = (block2, context) => {
  const { Box, Markdown } = context.elements;
  const markdown = block2.markdown ?? "";
  const lines = markdown.split("\n");
  const lineMarks = marksByLine(block2, lines, context.marks);
  const marks = lineMarks.flat();
  if (marks.length === 0 && !lines.some((line) => hasInline(line, context))) {
    return h(Markdown, { key: `md-${block2.line}`, text: markdown });
  }
  return h(
    Box,
    { key: `md-${block2.line}`, flexDirection: "column" },
    ...lines.map(
      (line, index) => renderTermText({
        elements: context.elements,
        line,
        marks: lineMarks[index] ?? [],
        parts: context.parts,
        theme: context.theme,
        ...context.columns === void 0 ? {} : { width: context.columns }
      })
    )
  );
};
var renderCallout = (block2, context) => {
  const callout = block2.callout;
  const { Box, Text: Text3 } = context.elements;
  if (callout === void 0) {
    return void 0;
  }
  const color = styleColor({
    name: CALLOUT_COLORS[callout.type] ?? "calloutNote",
    theme: context.theme
  });
  const label = callout.title ?? callout.type;
  const content = () => h(
    Box,
    { key: `callout-${block2.line}`, flexDirection: "row" },
    h(Text3, { color }, "\u2503 "),
    h(
      Box,
      { flexDirection: "column" },
      callout.closed ? void 0 : h(Text3, { bold: true, color }, label),
      ...callout.body.map((inner) => renderBlock({ block: inner, context }))
    )
  );
  if (!callout.closed || block2.fold === void 0) {
    return content();
  }
  return renderFold({
    key: `${context.blockKey}:${block2.fold.index}`,
    title: label,
    body: content,
    context
  });
};
var renderBlocks = (context) => (blocks) => h(
  context.elements.Box,
  { flexDirection: "column" },
  ...blocks.map((inner) => renderBlock({ block: inner, context }))
);
var renderBlock = (options) => {
  const { block: block2, context } = options;
  const { Box, Text: Text3 } = context.elements;
  switch (block2.kind) {
    case "table":
      return renderTable2(block2, context);
    case "heading": {
      const text2 = block2.heading?.text ?? "";
      const props = {
        bold: true,
        color: styleColor({ name: "heading", theme: context.theme })
      };
      if (hasInline(text2, context)) {
        return h(
          Box,
          { key: `heading-${block2.line}` },
          renderTermText({
            elements: context.elements,
            line: text2,
            marks: [],
            parts: context.parts,
            theme: context.theme,
            base: props
          })
        );
      }
      return h(Text3, { key: `heading-${block2.line}`, ...props }, text2);
    }
    case "callout":
      return renderCallout(block2, context);
    case "code":
      return renderCode(block2, context);
    case "fold": {
      const fold = block2.fold;
      if (fold === void 0) {
        return void 0;
      }
      return renderFold({
        key: `${context.blockKey}:${fold.index}`,
        title: fold.title,
        body: () => h(
          Box,
          { flexDirection: "column", paddingLeft: 2 },
          ...fold.body.map((inner) => renderBlock({ block: inner, context }))
        ),
        context
      });
    }
    case "steps":
      return renderSteps({ block: block2, context, renderBody: renderBlocks(context) });
    case "tree":
      return renderTree2({ block: block2, context });
    case "stack":
      return renderStack({ block: block2, context, renderBody: renderBlocks(context) });
    case "markdown":
      return renderMarkdown(block2, context);
    default: {
      const unreachable = block2.kind;
      return unreachable;
    }
  }
};
var childrenOf = (node) => {
  if (typeof node !== "object" || node === null) {
    return [];
  }
  const record = node;
  const children = record.children ?? record.props?.children;
  if (children === void 0) {
    return [];
  }
  return Array.isArray(children) ? children : [children];
};
var countTree = (node) => {
  const count = { nodes: 0, depth: 0, chars: 0, over: false };
  const visit3 = (current, depth) => {
    if (count.over || current === void 0 || current === null || current === false) {
      return;
    }
    if (typeof current === "string" || typeof current === "number") {
      count.chars += String(current).length;
    } else {
      count.nodes += 1;
      count.depth = Math.max(count.depth, depth);
      for (const child of childrenOf(current)) {
        visit3(child, depth + 1);
      }
    }
    count.over = count.nodes > TREE_LIMITS.nodes || count.depth > TREE_LIMITS.depth || count.chars > TREE_LIMITS.chars;
  };
  visit3(node, 1);
  return count;
};
async function renderReply($, e, next) {
  let settings;
  try {
    settings = await readSettings($);
  } catch (error2) {
    if (!(error2 instanceof SettingsError)) {
      throw error2;
    }
    $.ui.log(error2.message, { to: "debug" });
    return next(e);
  }
  if (!settings.enabled || !settings.targets.includes("assistant")) {
    return next(e);
  }
  const text2 = e.props.text;
  const blocks = splitBlocks({ text: text2, parts: settings.parts });
  const marks = await termMarksOf($, { settings, text: text2 });
  const elements = $.ui.resolve(e);
  const theme = await $.settings.read({ key: "theme" });
  const columns = e.viewport?.columns;
  const context = {
    elements,
    surface: e.surface,
    ...columns === void 0 ? {} : { columns },
    theme,
    blockKey: `${e.requestId ?? ""}:${hashText(text2)}`,
    parts: settings.parts,
    marks,
    ui: {
      copy: (args) => $.ui.copy(args),
      invalidate: (event) => $.ui.invalidate(event)
    }
  };
  const tree = h(
    elements.Box,
    { flexDirection: "column" },
    ...blocks.map((block2) => renderBlock({ block: block2, context })),
    ...settings.parts.footnote ? renderFootnotes2({ elements, marks }) : []
  );
  return countTree(tree).over ? next(e) : tree;
}

// src/mdmark-style/mod.tsx
function register(on) {
  on("ui.render", { component: "AssistantMessage" }, renderReply);
  on("ui.render", { component: "UserMessage" }, renderUserMessage);
  on("classic.SessionStart", injectMarkerGuide);
}
export {
  register
};
/*! Bundled license information:

is-plain-object/dist/is-plain-object.js:
  (*!
   * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
   *
   * Copyright (c) 2014-2017, Jon Schlinkert.
   * Released under the MIT License.
   *)

markdown-it/dist/markdown-it.mjs:
  (*! markdown-it 15.0.3 https://github.com/markdown-it/markdown-it @license MIT *)
*/
