// Cổng trại giam (minh họa vector, cơ sở HƯ CẤU) + châm ngôn tuyên truyền pháp luật cho trang chủ.
// Không dùng tên/huy hiệu của cơ quan hay trại giam có thật.

export const FACILITY_NAME = 'TRẠI GIAM AN BÌNH';
export const FACILITY_SUB = 'CƠ SỞ GIAM GIỮ HƯ CẤU · TRÒ CHƠI MỘT NGÀY MỚI';

export const SLOGANS: { text: string; note: string; icon: string }[] = [
  { icon: '⚖️', text: 'Mọi hành vi vi phạm pháp luật đều bị phát hiện và xử lý nghiêm minh', note: 'Pháp luật không có vùng cấm, không có ngoại lệ.' },
  { icon: '📜', text: 'Sống và làm việc theo Hiến pháp và pháp luật', note: 'Hiểu luật để bảo vệ mình và người thân.' },
  { icon: '⏳', text: 'Một phút sai lầm — cả đời ân hận', note: 'Hãy dừng lại trước khi quá muộn.' },
  { icon: '🕊️', text: 'Tự do là quý giá nhất — hãy giữ gìn bằng việc tuân thủ pháp luật', note: 'Không gì đổi được những ngày bên gia đình.' },
  { icon: '🌐', text: 'Lưới trời lồng lộng, thưa mà khó lọt', note: 'Người vi phạm sớm muộn cũng phải chịu trách nhiệm.' },
  { icon: '🚫', text: 'Nói không với ma túy, cờ bạc và tệ nạn xã hội', note: 'Tệ nạn là con đường ngắn nhất dẫn tới vi phạm pháp luật.' },
  { icon: '🍺', text: 'Đã uống rượu, bia — không lái xe', note: 'An toàn của bạn và người khác là trên hết.' },
  { icon: '🌱', text: 'Biết sai, biết sửa — hoàn lương là con đường sáng', note: 'Học tập, lao động, cải tạo tốt để sớm trở về với gia đình và xã hội.' },
];

export function GateScene({ compact = false, portrait = false, cover = false }: { compact?: boolean; portrait?: boolean; cover?: boolean }) {
  return (
    <svg className="gate-scene" viewBox={portrait ? '280 70 640 440' : '0 0 1200 560'} preserveAspectRatio={portrait && !cover ? 'xMidYMin meet' : 'xMidYMid slice'} role="img"
      aria-label={`Minh họa cổng ${FACILITY_NAME} (hư cấu): tường vàng, mái ngói đỏ, biển tên đỏ chữ vàng, cổng sắt, barie và chốt gác, khẩu hiệu tuyên truyền pháp luật.`}>
      <defs>
        <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9d6db" /><stop offset="1" stopColor="#eef1ec" /></linearGradient>
        <linearGradient id="gs-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8d8d86" /><stop offset="1" stopColor="#5f605b" /></linearGradient>
        <linearGradient id="gs-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4d77f" /><stop offset="1" stopColor="#e2bf5f" /></linearGradient>
        <linearGradient id="gs-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8432e" /><stop offset="1" stopColor="#8f2f20" /></linearGradient>
        <pattern id="gs-tiles" width="14" height="8" patternUnits="userSpaceOnUse"><rect width="14" height="8" fill="url(#gs-roof)" /><path d="M0 7.5h14M7 0v8" stroke="#7a2618" strokeWidth="0.8" opacity=".5" /></pattern>
        <pattern id="gs-bars" width="16" height="10" patternUnits="userSpaceOnUse"><rect x="6" width="3" height="10" fill="#4a4f52" /></pattern>
        <linearGradient id="gs-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stopColor="#0d1416" stopOpacity="0" /><stop offset="1" stopColor="#0d1416" stopOpacity=".85" /></linearGradient>
      </defs>
      {/* sky, hills, trees */}
      <rect width="1200" height="560" fill="url(#gs-sky)" />
      <path d="M0 210 Q150 120 300 180 T620 150 T900 170 T1200 130 V300 H0Z" fill="#7c9a76" opacity=".7" />
      <path d="M0 250 Q200 190 380 230 T760 215 T1200 205 V320 H0Z" fill="#5f8257" />
      {[[60, 200, 70], [140, 215, 55], [1080, 190, 75], [1160, 210, 60], [500, 230, 40], [700, 225, 45]].map(([x, y, r], i) => (
        <g key={i}><rect x={x - 5} y={y} width="10" height="80" fill="#4b3a2a" /><circle cx={x} cy={y} r={r} fill="#3f6b3a" /><circle cx={x + r * 0.4} cy={y - r * 0.3} r={r * 0.6} fill="#4f7d45" /></g>
      ))}
      {/* inner compound seen through the gate */}
      <polygon points="470,330 730,330 760,360 440,360" fill="#9a9a92" />
      <rect x="455" y="250" width="290" height="80" fill="#efd27a" />
      <polygon points="440,252 600,215 760,252" fill="url(#gs-tiles)" />
      {[485, 545, 615, 675].map((x) => <rect key={x} x={x} y="275" width="30" height="34" fill="#f6f2e4" stroke="#8a6a3a" strokeWidth="2" />)}
      <rect x="560" y="315" width="80" height="15" fill="#2f3b31" opacity=".3" />
      {/* perimeter walls */}
      <rect x="0" y="300" width="350" height="110" fill="url(#gs-wall)" />
      <rect x="0" y="392" width="350" height="18" fill="#b8913f" />
      <rect x="0" y="292" width="350" height="12" fill="#a33a27" />
      <rect x="850" y="300" width="350" height="110" fill="url(#gs-wall)" />
      <rect x="850" y="392" width="350" height="18" fill="#b8913f" />
      {/* left wall banner */}
      <rect x="28" y="318" width="294" height="54" rx="3" fill="#c8102e" stroke="#f2c94c" strokeWidth="3" />
      <text x="175" y="341" textAnchor="middle" fill="#ffd34d" fontSize="15" fontWeight="800" fontFamily="'Noto Sans','Segoe UI',sans-serif">SỐNG VÀ LÀM VIỆC THEO</text>
      <text x="175" y="362" textAnchor="middle" fill="#ffd34d" fontSize="15" fontWeight="800" fontFamily="'Noto Sans','Segoe UI',sans-serif">HIẾN PHÁP VÀ PHÁP LUẬT</text>
      {/* guard house (right) */}
      <rect x="880" y="255" width="260" height="155" fill="url(#gs-wall)" stroke="#b8913f" strokeWidth="2" />
      <polygon points="862,258 1010,205 1158,258" fill="url(#gs-tiles)" />
      <rect x="862" y="255" width="296" height="10" fill="#7a2618" />
      {[905, 975, 1045].map((x) => <g key={x}><rect x={x} y="285" width="52" height="50" fill="#dfe8ea" stroke="#f8f8f4" strokeWidth="5" /><path d={`M${x + 26} 285v50M${x} 310h52`} stroke="#f8f8f4" strokeWidth="3" /></g>)}
      <rect x="905" y="350" width="40" height="60" fill="#5a3b2a" />
      <rect x="880" y="392" width="260" height="18" fill="#9b2f22" />
      <text x="1010" y="378" textAnchor="middle" fill="#7a2618" fontSize="12" fontWeight="700" fontFamily="'Noto Sans','Segoe UI',sans-serif">TRỰC BAN · TIẾP DÂN</text>
      {/* gate: pillars, beam, roof, signboard */}
      <rect x="350" y="190" width="120" height="220" fill="url(#gs-wall)" />
      <rect x="730" y="190" width="120" height="220" fill="url(#gs-wall)" />
      <rect x="362" y="300" width="96" height="110" fill="#1f3b2d" />
      <rect x="742" y="300" width="96" height="110" fill="#1f3b2d" />
      <rect x="380" y="318" width="60" height="78" fill="#efd27a" />
      <rect x="760" y="318" width="60" height="78" fill="#efd27a" />
      <rect x="380" y="205" width="60" height="70" fill="#ead07a" stroke="#c5a24c" strokeWidth="2" />
      <rect x="760" y="205" width="60" height="70" fill="#ead07a" stroke="#c5a24c" strokeWidth="2" />
      <rect x="335" y="150" width="530" height="60" fill="url(#gs-wall)" />
      <polygon points="320,152 600,96 880,152" fill="url(#gs-tiles)" />
      <polygon points="300,190 340,150 860,150 900,190" fill="url(#gs-tiles)" opacity=".95" />
      <rect x="315" y="186" width="570" height="9" fill="#7a2618" />
      <rect x="370" y="198" width="460" height="56" rx="2" fill="#c8102e" stroke="#ffd34d" strokeWidth="3" />
      <text x="600" y="219" textAnchor="middle" fill="#ffe08a" fontSize="12" fontWeight="700" letterSpacing="1" fontFamily="'Noto Sans','Segoe UI',sans-serif">{FACILITY_SUB}</text>
      <text x="600" y="246" textAnchor="middle" fill="#ffd34d" fontSize="26" fontWeight="900" letterSpacing="2" fontFamily="'Noto Sans','Segoe UI',sans-serif">{FACILITY_NAME}</text>
      <circle cx="600" cy="125" r="13" fill="#ffd34d" stroke="#c8102e" strokeWidth="3" />
      {/* sliding iron gate (half open) */}
      <rect x="470" y="330" width="120" height="78" fill="url(#gs-bars)" />
      <rect x="470" y="330" width="120" height="6" fill="#3d4245" />
      <rect x="470" y="402" width="120" height="6" fill="#3d4245" />
      <path d="M470 336 L590 402 M470 402 L590 336" stroke="#3d4245" strokeWidth="3" />
      {/* barrier poles red/white */}
      {[345, 845].map((x) => (
        <g key={x}>
          <rect x={x - 12} y="380" width="24" height="30" fill="#8a8f92" />
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x={x - 4} y={232 + i * 17} width="8" height="17" fill={i % 2 ? '#f4f4f0' : '#d0312d'} />)}
        </g>
      ))}
      {/* warning plaque */}
      <rect x="742" y="322" width="96" height="44" fill="#f8f6ee" stroke="#c8102e" strokeWidth="2" />
      <text x="790" y="340" textAnchor="middle" fill="#c8102e" fontSize="10" fontWeight="800" fontFamily="'Noto Sans','Segoe UI',sans-serif">KHU VỰC CẤM</text>
      <text x="790" y="356" textAnchor="middle" fill="#333" fontSize="7.5" fontWeight="600" fontFamily="'Noto Sans','Segoe UI',sans-serif">Người không phận sự</text>
      <text x="790" y="364" textAnchor="middle" fill="#333" fontSize="7.5" fontWeight="600" fontFamily="'Noto Sans','Segoe UI',sans-serif">miễn vào</text>
      {/* road, puddles, guards */}
      <polygon points="300,410 900,410 1200,560 0,560" fill="url(#gs-road)" />
      <rect x="0" y="406" width="1200" height="6" fill="#7b7b74" />
      <ellipse cx="420" cy="480" rx="120" ry="14" fill="#a9b3b5" opacity=".35" />
      <ellipse cx="820" cy="520" rx="150" ry="16" fill="#a9b3b5" opacity=".3" />
      <path d="M600 410 L600 560" stroke="#e8e6dc" strokeWidth="6" strokeDasharray="30 26" opacity=".6" />
      {[[640, 372], [680, 378]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y - 26} r="6" fill="#d9a77a" /><rect x={x - 7} y={y - 20} width="14" height="20" rx="3" fill="#5a6b3c" /><rect x={x - 6} y={y} width="12" height="14" fill="#3f4a2c" /><rect x={x - 8} y={y - 34} width="16" height="5" rx="2" fill="#4b5a32" /></g>
      ))}
      {!compact && <rect width="1200" height="560" fill="url(#gs-shade)" />}
    </svg>
  );
}

/** LED-style ticker of slogans (static list when reduced motion). */
export function SloganTicker() {
  const items = SLOGANS.map((s) => s.text);
  return (
    <div className="ticker" role="marquee" aria-label="Khẩu hiệu tuyên truyền pháp luật">
      <div className="ticker-track">
        {[...items, ...items].map((t, i) => <span key={i} aria-hidden={i >= items.length}>★ {t.toUpperCase()}</span>)}
      </div>
    </div>
  );
}
