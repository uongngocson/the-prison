// Cổng trại giam kiểu Mỹ (minh họa vector, cơ sở HƯ CẤU): hàng rào kép + dây thép gai, chòi canh, cổng sally port,
// biển giàn thép, đèn pha. Không dùng tên/huy hiệu của cơ quan hay trại giam có thật.

export const FACILITY_NAME = 'NEW DAY CORRECTIONAL FACILITY';
export const FACILITY_SUB = 'FICTIONAL FACILITY · MỘT NGÀY MỚI';

/** Thông báo của trại (kiểu biển nội quy cơ sở cải huấn Mỹ) — dùng cho băng chữ chạy và cửa sổ thông tin. */
export const SLOGANS: { text: string; note: string; icon: string }[] = [
  { icon: '⚖️', text: 'Every action has consequences — choose the right path', note: 'Mỗi hành động đều có hệ quả, hãy chọn con đường đúng.' },
  { icon: '📚', text: 'Education opens doors — enroll in GED & vocational programs', note: 'Học tập và học nghề là chìa khóa để trở về.' },
  { icon: '🤝', text: 'Respect · Responsibility · Reentry', note: 'Tôn trọng, trách nhiệm và tái hòa nhập.' },
  { icon: '🚫', text: 'Contraband is prohibited — all persons are subject to search', note: 'Cấm mang vật phẩm trái phép, mọi người đều có thể bị kiểm tra.' },
  { icon: '🕊️', text: 'Freedom is earned every day by the choices you make', note: 'Tự do được giữ gìn bằng lựa chọn mỗi ngày.' },
  { icon: '🍺', text: 'Don’t drink and drive — one mistake can cost a lifetime', note: 'Đã uống rượu bia thì không lái xe.' },
  { icon: '📞', text: 'Stay connected — family visits & letters keep you strong', note: 'Giữ liên lạc với gia đình để vững vàng.' },
  { icon: '🌱', text: 'It’s never too late to start a new day', note: 'Làm lại chưa bao giờ là muộn.' },
];

const SIGN_FONT = "'Bahnschrift','Barlow Condensed','Arial Narrow','Noto Sans','Segoe UI',sans-serif";

/** Một ô cửa sổ khe hẹp của dãy buồng giam (sáng/tối xen kẽ). */
const slits = (x0: number, x1: number, y: number, h: number, seed: number) =>
  Array.from({ length: Math.floor((x1 - x0) / 24) }, (_, i) => {
    const x = x0 + 10 + i * 24;
    const lit = (i * 7 + seed) % 5 < 2;
    return <rect key={`${seed}-${i}`} x={x} y={y} width="6" height={h} rx="1" fill={lit ? 'url(#gs-lit)' : '#2a313b'} />;
  });

function Tower({ x }: { x: number }) {
  return (
    <g>
      {/* thân bê tông */}
      <polygon points={`${x - 22},410 ${x + 22},410 ${x + 16},170 ${x - 16},170`} fill="url(#gs-concrete)" />
      <rect x={x - 16} y="170" width="32" height="6" fill="#59585a" />
      {[220, 280, 340].map((y) => <rect key={y} x={x - 18} y={y} width="36" height="2" fill="#6d6b68" opacity=".6" />)}
      <rect x={x - 3} y="300" width="6" height="22" fill="#2a2e35" />
      {/* sàn đi + lan can */}
      <rect x={x - 52} y="164" width="104" height="8" fill="#3c4047" />
      <rect x={x - 52} y="150" width="104" height="2" fill="#4a4f57" />
      {Array.from({ length: 14 }, (_, i) => <rect key={i} x={x - 52 + i * 8} y="150" width="1.5" height="14" fill="#4a4f57" />)}
      {/* cabin kính */}
      <rect x={x - 42} y="112" width="84" height="40" fill="#3a3f47" />
      <rect x={x - 38} y="116" width="76" height="30" fill="url(#gs-cab)" />
      {[-19, 0, 19].map((d) => <rect key={d} x={x + d - 1} y="116" width="2" height="30" fill="#30353c" />)}
      <rect x={x - 6} y="128" width="12" height="18" fill="#1b2230" opacity=".55" />
      {/* mái */}
      <polygon points={`${x - 54},112 ${x + 54},112 ${x + 44},100 ${x - 44},100`} fill="#2c3037" />
      <rect x={x - 2} y="82" width="4" height="18" fill="#2c3037" />
      <circle cx={x} cy="81" r="3" fill="#ff4b3a" />
      <circle cx={x} cy="81" r="9" fill="url(#gs-red)" />
      {/* đèn rọi */}
      <rect x={x + 30} y="104" width="12" height="8" rx="2" fill="#1e2228" />
      <circle cx={x + 42} cy="108" r="4" fill="#fffbe8" />
    </g>
  );
}

function Officer({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s} 1)`}>
      <ellipse cx="0" cy="34" rx="12" ry="3" fill="#000" opacity=".35" />
      <rect x="-6" y="14" width="5" height="20" fill="#1b212c" /><rect x="1" y="14" width="5" height="20" fill="#1b212c" />
      <rect x="-8" y="-6" width="16" height="22" rx="3" fill="#2a3a55" />
      <rect x="-8" y="11" width="16" height="3" fill="#0f1114" />
      <circle cx="4" cy="0" r="1.6" fill="#d6b65a" />
      <rect x="-12" y="-4" width="4" height="16" rx="2" fill="#2a3a55" /><rect x="8" y="-4" width="4" height="16" rx="2" fill="#2a3a55" />
      <circle cx="0" cy="-12" r="6" fill="#c99068" />
      <path d="M-7 -14 Q0 -22 7 -14 Z" fill="#1d2a40" /><rect x="-1" y="-15.5" width="10" height="2.2" rx="1" fill="#1d2a40" />
    </g>
  );
}

export function GateScene({ compact = false, portrait = false, cover = false }: { compact?: boolean; portrait?: boolean; cover?: boolean }) {
  return (
    <svg className="gate-scene" viewBox={portrait ? '280 70 640 440' : '0 0 1200 560'} preserveAspectRatio={portrait && !cover ? 'xMidYMin meet' : 'xMidYMid slice'} role="img"
      aria-label={`Minh họa cổng ${FACILITY_NAME} (hư cấu) lúc chạng vạng: hàng rào lưới kép có dây thép gai, hai chòi canh có đèn rọi, cổng sally port, biển giàn thép, dãy buồng giam bê tông, cột cờ và xe tuần tra.`}>
      <defs>
        <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1424" /><stop offset=".38" stopColor="#1f3350" /><stop offset=".62" stopColor="#5b5a6a" /><stop offset=".8" stopColor="#d58a4c" /><stop offset="1" stopColor="#f1b46a" />
        </linearGradient>
        <linearGradient id="gs-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d4048" /><stop offset="1" stopColor="#1d1f24" /></linearGradient>
        <linearGradient id="gs-block" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a49c8c" /><stop offset="1" stopColor="#7a7468" /></linearGradient>
        <linearGradient id="gs-block-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b8578" /><stop offset="1" stopColor="#5f5a52" /></linearGradient>
        <linearGradient id="gs-concrete" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#77746c" /><stop offset=".45" stopColor="#a8a296" /><stop offset="1" stopColor="#6a675f" /></linearGradient>
        <linearGradient id="gs-cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe3a3" /><stop offset="1" stopColor="#e8a55b" /></linearGradient>
        <linearGradient id="gs-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe2a0" /><stop offset="1" stopColor="#f0a24e" /></linearGradient>
        <linearGradient id="gs-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff8dc" stopOpacity=".55" /><stop offset="1" stopColor="#fff8dc" stopOpacity="0" /></linearGradient>
        <linearGradient id="gs-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6e7681" /><stop offset="1" stopColor="#3b4048" /></linearGradient>
        <linearGradient id="gs-sign" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c3561" /><stop offset="1" stopColor="#122546" /></linearGradient>
        <radialGradient id="gs-glow"><stop offset="0" stopColor="#fff6d6" stopOpacity=".95" /><stop offset=".35" stopColor="#ffd98a" stopOpacity=".35" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
        <radialGradient id="gs-red"><stop offset="0" stopColor="#ff5a45" stopOpacity=".8" /><stop offset="1" stopColor="#ff5a45" stopOpacity="0" /></radialGradient>
        <pattern id="gs-chain" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 0L9 9M9 0L0 9" stroke="#c4ccd4" strokeWidth=".55" opacity=".55" /></pattern>
        <pattern id="gs-razor" width="16" height="14" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="7" r="6" fill="none" stroke="#d3d9de" strokeWidth="1" opacity=".85" />
          <circle cx="0" cy="7" r="6" fill="none" stroke="#aab2b9" strokeWidth=".8" opacity=".7" />
          <path d="M5 2l2 2M11 10l2 2M3 10l-2 2" stroke="#e8edf0" strokeWidth=".8" />
        </pattern>
        <pattern id="gs-gatebars" width="10" height="10" patternUnits="userSpaceOnUse"><rect x="4" width="2.5" height="10" fill="#4a515b" /></pattern>
        <linearGradient id="gs-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stopColor="#070b12" stopOpacity="0" /><stop offset="1" stopColor="#070b12" stopOpacity=".88" /></linearGradient>
      </defs>

      {/* bầu trời chạng vạng, sao, trăng */}
      <rect width="1200" height="560" fill="url(#gs-sky)" />
      {[[80, 40], [190, 70], [330, 30], [470, 58], [690, 26], [760, 72], [880, 44], [1010, 30], [1130, 66], [560, 90], [260, 110], [980, 100]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1 : 1.6} fill="#fff" opacity={i % 2 ? .55 : .85} />)}
      <circle cx="1060" cy="70" r="40" fill="url(#gs-glow)" opacity=".35" /><circle cx="1060" cy="70" r="15" fill="#f3ead2" opacity=".92" />

      {/* dãy núi xa */}
      <path d="M0 262 L90 228 L170 250 L260 210 L360 244 L450 222 L560 252 L660 214 L770 246 L860 220 L960 250 L1060 216 L1200 244 V320 H0Z" fill="#3a3d52" opacity=".85" />
      <path d="M0 286 L120 262 L250 280 L380 258 L520 284 L640 266 L780 286 L900 264 L1040 284 L1200 268 V330 H0Z" fill="#2c3044" />

      {/* tháp nước */}
      <g>
        {[1090, 1150].map((x) => <rect key={x} x={x} y="150" width="3" height="115" fill="#40444f" />)}
        <path d="M1090 200 L1153 245 M1153 200 L1090 245" stroke="#40444f" strokeWidth="2" />
        <rect x="1080" y="120" width="82" height="36" rx="6" fill="#8d939c" /><ellipse cx="1121" cy="120" rx="41" ry="9" fill="#a3a9b1" />
        <text x="1121" y="144" textAnchor="middle" fill="#2c3442" fontSize="12" fontWeight="800" letterSpacing="2" fontFamily={SIGN_FONT}>NDCF</text>
      </g>

      {/* dãy buồng giam bê tông phía sau hàng rào */}
      <rect x="40" y="236" width="400" height="96" fill="url(#gs-block)" /><rect x="40" y="230" width="400" height="8" fill="#5c574f" />
      {slits(40, 440, 252, 34, 1)}
      <rect x="40" y="300" width="400" height="3" fill="#6b655c" />
      <text x="240" y="322" textAnchor="middle" fill="#4b463f" fontSize="13" fontWeight="800" letterSpacing="5" fontFamily={SIGN_FONT}>HOUSING UNIT A</text>
      <rect x="760" y="236" width="400" height="96" fill="url(#gs-block)" /><rect x="760" y="230" width="400" height="8" fill="#5c574f" />
      {slits(760, 1160, 252, 34, 3)}
      <rect x="760" y="300" width="400" height="3" fill="#6b655c" />
      <text x="960" y="322" textAnchor="middle" fill="#4b463f" fontSize="13" fontWeight="800" letterSpacing="5" fontFamily={SIGN_FONT}>HOUSING UNIT B</text>
      {/* tòa hành chính */}
      <rect x="470" y="206" width="260" height="126" fill="url(#gs-block-dark)" /><rect x="462" y="198" width="276" height="10" fill="#4e4a44" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3, 4, 5].map((c) => <rect key={`${r}${c}`} x={488 + c * 38} y={220 + r * 26} width="26" height="14" fill={(r + c) % 3 === 0 ? 'url(#gs-lit)' : '#2c333d'} />))}

      {/* cột cờ */}
      <rect x="826" y="96" width="3" height="200" fill="#c8ccd1" /><circle cx="827.5" cy="95" r="3" fill="#d6b65a" />
      <g transform="translate(829 100)">
        {Array.from({ length: 7 }, (_, i) => <rect key={i} y={i * 5} width="56" height="5" fill={i % 2 ? '#f2f2f2' : '#b22234'} />)}
        <rect width="24" height="20" fill="#3c3b6e" />
        {[[4, 4], [12, 4], [20, 4], [8, 10], [16, 10], [4, 16], [12, 16], [20, 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="#fff" />)}
      </g>

      {/* đèn pha cột cao */}
      {[90, 1110].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="120" width="4" height="290" fill="#3a3e46" />
          <rect x={x - 26} y="114" width="52" height="6" fill="#2a2d33" />
          {[-18, -6, 6, 18].map((d) => <rect key={d} x={x + d - 4} y="120" width="8" height="6" fill="#fff4cf" />)}
          <circle cx={x} cy="124" r="56" fill="url(#gs-glow)" />
        </g>
      ))}

      {/* tia đèn rọi từ chòi canh */}
      <polygon points="292,108 300,112 560,452 400,460" fill="url(#gs-beam)" opacity=".5" />
      <polygon points="908,108 900,112 830,462 680,452" fill="url(#gs-beam)" opacity=".42" />

      {/* hàng rào trong */}
      <rect x="0" y="282" width="1200" height="78" fill="url(#gs-chain)" />
      <rect x="0" y="280" width="1200" height="2" fill="#7f8891" />
      <rect x="0" y="268" width="1200" height="14" fill="url(#gs-razor)" opacity=".75" />
      {Array.from({ length: 21 }, (_, i) => <rect key={i} x={i * 60 - 1} y="276" width="2.5" height="84" fill="#6d757e" />)}

      {/* chòi canh */}
      <Tower x={250} />
      <Tower x={950} />

      {/* hàng rào ngoài + dây thép gai cuộn */}
      <rect x="0" y="322" width="470" height="88" fill="url(#gs-chain)" />
      <rect x="730" y="322" width="470" height="88" fill="url(#gs-chain)" />
      <rect x="0" y="320" width="470" height="3" fill="#8b949d" /><rect x="730" y="320" width="470" height="3" fill="#8b949d" />
      <rect x="0" y="302" width="470" height="20" fill="url(#gs-razor)" /><rect x="730" y="302" width="470" height="20" fill="url(#gs-razor)" />
      {Array.from({ length: 9 }, (_, i) => <rect key={`l${i}`} x={i * 56} y="314" width="4" height="96" fill="#5f6770" />)}
      {Array.from({ length: 9 }, (_, i) => <rect key={`r${i}`} x={736 + i * 56} y="314" width="4" height="96" fill="#5f6770" />)}
      <rect x="0" y="404" width="470" height="6" fill="#3d434b" /><rect x="730" y="404" width="470" height="6" fill="#3d434b" />

      {/* cổng sally port: hai chốt gác + cổng trượt thép */}
      {[[440, 'GATE 1'], [700, 'CONTROL']].map(([x, label]) => (
        <g key={label as string}>
          <rect x={x as number} y="300" width="60" height="110" fill="url(#gs-block-dark)" />
          <rect x={(x as number) - 4} y="294" width="68" height="8" fill="#3f3b36" />
          <rect x={(x as number) + 8} y="314" width="44" height="30" fill="url(#gs-lit)" />
          <rect x={(x as number) + 29} y="314" width="2" height="30" fill="#4a4540" />
          <rect x={(x as number) + 8} y="352" width="44" height="12" fill="#c9a646" />
          <text x={(x as number) + 30} y="361.5" textAnchor="middle" fill="#14171c" fontSize="8.5" fontWeight="900" letterSpacing="1" fontFamily={SIGN_FONT}>{label}</text>
        </g>
      ))}
      <rect x="500" y="318" width="200" height="88" fill="url(#gs-gatebars)" />
      <rect x="500" y="316" width="200" height="6" fill="#3a3f47" /><rect x="500" y="360" width="200" height="4" fill="#3a3f47" /><rect x="500" y="402" width="200" height="6" fill="#3a3f47" />
      <path d="M500 322 L600 402 M600 322 L500 402 M600 322 L700 402 M700 322 L600 402" stroke="#3a3f47" strokeWidth="2.5" />
      <rect x="598" y="316" width="4" height="92" fill="#3a3f47" />
      {/* đèn tín hiệu */}
      <rect x="504" y="292" width="12" height="24" rx="2" fill="#15171b" /><circle cx="510" cy="299" r="3.2" fill="#ff3b30" /><circle cx="510" cy="309" r="3.2" fill="#123d1f" />
      <circle cx="510" cy="299" r="10" fill="url(#gs-red)" />

      {/* giàn biển tên */}
      <rect x="386" y="182" width="8" height="128" fill="url(#gs-steel)" /><rect x="806" y="182" width="8" height="128" fill="url(#gs-steel)" />
      <path d="M394 266 H806" stroke="#4b525c" strokeWidth="4" />
      <path d={Array.from({ length: 20 }, (_, i) => `M${394 + i * 20.6} 266 L${404.3 + i * 20.6} 258 L${414.6 + i * 20.6} 266`).join(' ')} stroke="#4b525c" strokeWidth="1.5" fill="none" />
      <rect x="372" y="172" width="456" height="88" rx="4" fill="url(#gs-sign)" stroke="#d7dde4" strokeWidth="3" />
      <rect x="380" y="180" width="440" height="72" rx="2" fill="none" stroke="#d7dde4" strokeWidth="1" opacity=".55" />
      <rect x="380" y="231" width="440" height="3" fill="#c9a646" />
      <g transform="translate(408 212)">
        <path d="M0 -22 L18 -15 V2 Q18 16 0 24 Q-18 16 -18 2 V-15 Z" fill="#c9a646" stroke="#f3e3a8" strokeWidth="1.5" />
        <path d="M0 -14 L11 -9 V2 Q11 11 0 16 Q-11 11 -11 2 V-9 Z" fill="#1c3561" />
        <path d="M0 -7 L2.2 -1.6 L7.8 -1.4 L3.4 2 L5 7.4 L0 4.2 L-5 7.4 L-3.4 2 L-7.8 -1.4 L-2.2 -1.6 Z" fill="#f3e3a8" />
      </g>
      <text x="612" y="208" textAnchor="middle" fill="#ffffff" fontSize="29" fontWeight="800" letterSpacing="3" fontFamily={SIGN_FONT}>NEW DAY</text>
      <text x="612" y="228" textAnchor="middle" fill="#dfe6ee" fontSize="15" fontWeight="700" letterSpacing="4.2" fontFamily={SIGN_FONT}>CORRECTIONAL FACILITY</text>
      <text x="612" y="247" textAnchor="middle" fill="#c9d3de" fontSize="9.5" fontWeight="600" letterSpacing="2.2" fontFamily={SIGN_FONT}>{FACILITY_SUB}</text>
      {[396, 804].map((x) => <g key={x}><rect x={x - 10} y="164" width="20" height="6" fill="#2a2d33" /><circle cx={x} cy="174" r="22" fill="url(#gs-glow)" opacity=".7" /></g>)}

      {/* mặt đường, vạch STOP, vạch vàng đôi, gờ giảm tốc */}
      <polygon points="0,410 1200,410 1200,560 0,560" fill="#25282e" />
      <polygon points="470,410 730,410 1060,560 140,560" fill="url(#gs-road)" />
      <rect x="0" y="408" width="1200" height="4" fill="#5d636b" />
      <path d="M596 412 L560 560 M604 412 L640 560" stroke="#e8b424" strokeWidth="3.5" />
      <polygon points="430,440 770,440 778,452 422,452" fill="#ecebe6" opacity=".92" />
      <text x="600" y="486" textAnchor="middle" fill="#ecebe6" opacity=".85" fontSize="30" fontWeight="900" letterSpacing="10" fontFamily={SIGN_FONT} transform="matrix(1 0 0 .55 0 216)">STOP</text>
      {Array.from({ length: 12 }, (_, i) => <polygon key={i} points={`${380 + i * 38},500 ${404 + i * 38},500 ${400 + i * 38},512 ${374 + i * 38},512`} fill={i % 2 ? '#1c1d20' : '#e8b424'} />)}
      <ellipse cx="300" cy="530" rx="160" ry="10" fill="#9aa6b8" opacity=".12" />
      <ellipse cx="880" cy="540" rx="190" ry="12" fill="#9aa6b8" opacity=".1" />

      {/* biển cảnh báo bên đường */}
      <g>
        <rect x="186" y="440" width="4" height="70" fill="#7d838a" /><rect x="306" y="440" width="4" height="70" fill="#7d838a" />
        <rect x="160" y="376" width="176" height="76" rx="3" fill="#f4f3ee" stroke="#1d1f24" strokeWidth="2" />
        <rect x="160" y="376" width="176" height="20" rx="3" fill="#c62f26" />
        <text x="248" y="391" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900" letterSpacing="3" fontFamily={SIGN_FONT}>WARNING</text>
        <text x="248" y="410" textAnchor="middle" fill="#16181c" fontSize="9.2" fontWeight="800" letterSpacing=".6" fontFamily={SIGN_FONT}>ALL PERSONS, VEHICLES AND</text>
        <text x="248" y="422" textAnchor="middle" fill="#16181c" fontSize="9.2" fontWeight="800" letterSpacing=".6" fontFamily={SIGN_FONT}>PROPERTY ARE SUBJECT TO SEARCH</text>
        <text x="248" y="440" textAnchor="middle" fill="#c62f26" fontSize="8.4" fontWeight="800" letterSpacing="1" fontFamily={SIGN_FONT}>NO WEAPONS · NO CONTRABAND</text>
      </g>
      <g>
        <rect x="1006" y="430" width="4" height="70" fill="#7d838a" />
        <rect x="972" y="392" width="72" height="44" rx="3" fill="#1c3561" stroke="#e8edf2" strokeWidth="2" />
        <text x="1008" y="410" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" letterSpacing="1" fontFamily={SIGN_FONT}>VISITOR</text>
        <text x="1008" y="424" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800" letterSpacing="1" fontFamily={SIGN_FONT}>PARKING ➜</text>
      </g>

      {/* xe tuần tra */}
      <g transform="translate(760 446)">
        <ellipse cx="62" cy="46" rx="70" ry="6" fill="#000" opacity=".4" />
        <path d="M6 18 Q8 6 24 4 L44 -10 Q50 -14 62 -14 L92 -14 Q102 -14 108 -6 L118 6 Q130 8 132 18 L132 36 Q132 40 128 40 L8 40 Q4 40 4 36 Z" fill="#eef0f2" />
        <path d="M48 -8 L60 -10 L60 4 L36 4 Z" fill="#26303c" /><path d="M66 -10 L92 -10 Q98 -10 102 -4 L108 4 L66 4 Z" fill="#26303c" />
        <rect x="4" y="18" width="128" height="7" fill="#1c3561" /><rect x="4" y="25" width="128" height="2" fill="#c9a646" />
        <text x="68" y="23.6" textAnchor="middle" fill="#ffffff" fontSize="6.4" fontWeight="800" letterSpacing="1.4" fontFamily={SIGN_FONT}>CORRECTIONS</text>
        <rect x="60" y="-20" width="12" height="6" rx="2" fill="#e5352b" /><rect x="72" y="-20" width="12" height="6" rx="2" fill="#2f6bff" />
        <circle cx="66" cy="-17" r="12" fill="url(#gs-red)" />
        {[30, 106].map((cx) => <g key={cx}><circle cx={cx} cy="40" r="10" fill="#111317" /><circle cx={cx} cy="40" r="4.5" fill="#8d939c" /></g>)}
        <rect x="128" y="20" width="5" height="6" rx="1" fill="#ffe7a8" />
      </g>

      {/* nhân viên trực cổng */}
      <Officer x={560} y={380} />
      <Officer x={640} y={384} flip />

      {!compact && <rect width="1200" height="560" fill="url(#gs-shade)" />}
    </svg>
  );
}

/** Băng chữ LED kiểu bảng thông báo của trại (danh sách tĩnh khi giảm chuyển động). */
export function SloganTicker() {
  const items = SLOGANS.map((s) => s.text);
  return (
    <div className="ticker" role="marquee" aria-label="Thông báo của trại">
      <div className="ticker-track">
        {[...items, ...items].map((t, i) => <span key={i} aria-hidden={i >= items.length}>▸ {t.toUpperCase()}</span>)}
      </div>
    </div>
  );
}
