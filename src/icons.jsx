const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ children, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const Icon = {
  home: () => (
    <Svg>
      <path {...stroke} d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />
    </Svg>
  ),
  album: () => (
    <Svg>
      <rect {...stroke} x="3" y="5" width="18" height="14" rx="2.5" />
      <circle {...stroke} cx="8.6" cy="10" r="1.6" />
      <path {...stroke} d="m4 17 4.6-4.4 3.2 3 3-2.6L20 17" />
    </Svg>
  ),
  family: () => (
    <Svg>
      <circle {...stroke} cx="8.6" cy="9" r="3" />
      <circle {...stroke} cx="16.4" cy="10.4" r="2.3" />
      <path {...stroke} d="M3.6 19c.5-2.8 2.6-4.4 5-4.4s4.5 1.6 5 4.4" />
      <path {...stroke} d="M15.2 14.9c2.1-.4 4.3.9 5.2 4.1" />
    </Svg>
  ),
  plus: () => (
    <Svg>
      <path {...stroke} strokeWidth="1.9" d="M12 5v14M5 12h14" />
    </Svg>
  ),
  close: () => (
    <Svg>
      <path {...stroke} d="m6 6 12 12M18 6 6 18" />
    </Svg>
  ),
  check: () => (
    <Svg>
      <path {...stroke} d="m5 12.6 4.5 4.4L19 7.4" />
    </Svg>
  ),
  caret: () => (
    <Svg>
      <path {...stroke} d="m6 9.5 6 5.5 6-5.5" />
    </Svg>
  ),
  back: () => (
    <Svg>
      <path {...stroke} d="M15 5.5 8.5 12l6.5 6.5" />
    </Svg>
  ),
  forward: () => (
    <Svg>
      <path {...stroke} d="M9 5.5 15.5 12 9 18.5" />
    </Svg>
  ),
  play: () => (
    <Svg>
      <path {...stroke} d="M8 5.6 18.5 12 8 18.4z" />
    </Svg>
  ),
  pause: () => (
    <Svg>
      <path {...stroke} d="M9.5 5.5v13M14.5 5.5v13" />
    </Svg>
  ),
  stop: () => (
    <Svg>
      <rect {...stroke} x="6.5" y="6.5" width="11" height="11" rx="2" />
    </Svg>
  ),
  upload: () => (
    <Svg>
      <path {...stroke} d="M12 16V5.5m0 0L8.2 9.3M12 5.5l3.8 3.8" />
      <path {...stroke} d="M4.5 15v3.2a1.3 1.3 0 0 0 1.3 1.3h12.4a1.3 1.3 0 0 0 1.3-1.3V15" />
    </Svg>
  ),
  pen: () => (
    <Svg>
      <path {...stroke} d="M16.2 4.4 19.6 7.8 9.4 18l-4 .6.6-4z" />
      <path {...stroke} d="m14.5 6.1 3.4 3.4" />
    </Svg>
  ),
  copy: () => (
    <Svg>
      <rect {...stroke} x="9" y="9" width="11" height="11" rx="2" />
      <path {...stroke} d="M15.4 5.5H6a1.5 1.5 0 0 0-1.5 1.5v9.4" />
    </Svg>
  ),
  trash: () => (
    <Svg>
      <path {...stroke} d="M5 7h14M10 7V5.4A1.4 1.4 0 0 1 11.4 4h1.2A1.4 1.4 0 0 1 14 5.4V7" />
      <path {...stroke} d="M6.6 7 7.5 19a1.4 1.4 0 0 0 1.4 1.3h6.2A1.4 1.4 0 0 0 16.5 19L17.4 7" />
    </Svg>
  ),
  clock: () => (
    <Svg>
      <circle {...stroke} cx="12" cy="12" r="8" />
      <path {...stroke} d="M12 7.6V12l3 2" />
    </Svg>
  ),
  chart: () => (
    <Svg>
      <path {...stroke} d="M4.5 19.5h15" />
      <path {...stroke} d="M7.4 19.5v-6.2M12 19.5V7.2M16.6 19.5v-9" />
    </Svg>
  ),
  image: () => (
    <Svg>
      <rect {...stroke} x="3.5" y="5.5" width="17" height="13" rx="2.4" />
      <circle {...stroke} cx="9" cy="10.2" r="1.5" />
      <path {...stroke} d="m4.6 16.8 4.2-4 2.9 2.7 3-2.6 4.7 3.9" />
    </Svg>
  ),
  camera: () => (
    <Svg>
      <path {...stroke} d="M4.5 8.6h3l1.4-2.2h6.2l1.4 2.2h3a1.4 1.4 0 0 1 1.4 1.4v7.4a1.4 1.4 0 0 1-1.4 1.4H4.5a1.4 1.4 0 0 1-1.4-1.4V10a1.4 1.4 0 0 1 1.4-1.4z" />
      <circle {...stroke} cx="12" cy="13.4" r="3.1" />
    </Svg>
  ),
};

// 记录类型图标：线性、圆润，和界面同一套笔画粗细。
export const Glyph = {
  nursing: () => (
    <Svg>
      <circle {...stroke} cx="9.4" cy="7" r="2.6" />
      <path {...stroke} d="M3.8 19.4c.3-3.4 2.5-5.6 5.6-5.6 1.5 0 2.7.5 3.6 1.3" />
      <path {...stroke} d="M13.2 15.4c1.6-1.3 4-1.4 5.6.1 1.4 1.3 1.6 3.4.4 4.9" />
    </Svg>
  ),
  bottle: () => (
    <Svg>
      <path {...stroke} d="M11 3.4h2v2.2h-2z" />
      <path {...stroke} d="M9.6 7.6h4.8a1 1 0 0 1 1 1v10.2a1.6 1.6 0 0 1-1.6 1.6h-3.6a1.6 1.6 0 0 1-1.6-1.6V8.6a1 1 0 0 1 1-1z" />
      <path {...stroke} d="M8.7 12.4h6.6M8.7 15.6h6.6" />
    </Svg>
  ),
  diaper: () => (
    <Svg>
      <path {...stroke} d="M4.5 7h15v3.4c0 4.6-3.2 8.2-7.5 9.4C7.7 18.6 4.5 15 4.5 10.4z" />
      <path {...stroke} d="M9.6 10.6h4.8" />
    </Svg>
  ),
  pump: () => (
    <Svg>
      <path {...stroke} d="M8 4.6h5.4l2.4 3.2H8z" />
      <path {...stroke} d="M9 7.8h5.6a1.2 1.2 0 0 1 1.2 1.2v9.6a1.6 1.6 0 0 1-1.6 1.6h-4.8a1.6 1.6 0 0 1-1.6-1.6V9a1.2 1.2 0 0 1 1.2-1.2z" />
      <path {...stroke} d="M8.4 14.6h7.2" />
    </Svg>
  ),
  stock: () => (
    <Svg>
      <path {...stroke} d="M6.4 8.2h11.2l-.9 10.4a1.4 1.4 0 0 1-1.4 1.3H8.7a1.4 1.4 0 0 1-1.4-1.3z" />
      <path {...stroke} d="M9 8.2V6a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 6v2.2" />
      <path {...stroke} d="M7.9 13.4h8.2" />
    </Svg>
  ),
  sleep: () => (
    <Svg>
      <path {...stroke} d="M19.4 14.2A7.4 7.4 0 0 1 9.7 4.6a7.6 7.6 0 1 0 9.7 9.6z" />
      <path {...stroke} d="M14.4 4.6h3.4l-3.4 3.6h3.4" />
    </Svg>
  ),
  thermometer: () => (
    <Svg>
      <path {...stroke} d="M14 13.6V6.2a2 2 0 1 0-4 0v7.4a4 4 0 1 0 4 0z" />
      <path {...stroke} d="M12 9.4v6.4" />
    </Svg>
  ),
  ruler: () => (
    <Svg>
      <rect {...stroke} x="3.4" y="8.6" width="17.2" height="6.8" rx="1.6" />
      <path {...stroke} d="M7.6 8.6v3M11.2 8.6v4.2M14.8 8.6v3M18.2 8.6v4.2" />
    </Svg>
  ),
  capsule: () => (
    <Svg>
      <rect {...stroke} x="3.2" y="8.4" width="17.6" height="7.2" rx="3.6" transform="rotate(-38 12 12)" />
      <path {...stroke} d="M9.4 8.2 15.8 14.6" />
    </Svg>
  ),
  plate: () => (
    <Svg>
      <circle {...stroke} cx="12" cy="12" r="7.6" />
      <circle {...stroke} cx="12" cy="12" r="3.8" />
    </Svg>
  ),
  juice: () => (
    <Svg>
      <path {...stroke} d="M7.4 7.4h9.2v11.2a1.4 1.4 0 0 1-1.4 1.4H8.8a1.4 1.4 0 0 1-1.4-1.4z" />
      <path {...stroke} d="M13.6 7.4V4.6h3" />
      <path {...stroke} d="M9.8 11.4h4.4" />
    </Svg>
  ),
  pencil: () => (
    <Svg>
      <path {...stroke} d="M15.2 4.9 19.1 8.8 8.6 19.3l-4.5.6.6-4.5z" />
      <path {...stroke} d="m13.2 6.9 3.9 3.9" />
    </Svg>
  ),
  camera: () => (
    <Svg>
      <path {...stroke} d="M4.5 8.6h3l1.4-2.2h6.2l1.4 2.2h3a1.4 1.4 0 0 1 1.4 1.4v7.4a1.4 1.4 0 0 1-1.4 1.4H4.5a1.4 1.4 0 0 1-1.4-1.4V10a1.4 1.4 0 0 1 1.4-1.4z" />
      <circle {...stroke} cx="12" cy="13.4" r="3.1" />
    </Svg>
  ),
  sun: () => (
    <Svg>
      <circle {...stroke} cx="12" cy="12" r="4" />
      <path {...stroke} d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" />
    </Svg>
  ),
  syringe: () => (
    <Svg>
      <path {...stroke} d="m14 4.6 5.4 5.4M17.2 5.6 9.6 13.2l-1 4.2 4.2-1 7.6-7.6z" />
      <path {...stroke} d="M5.2 18.8 8.6 15.4M11.6 8.8l3.6 3.6" />
    </Svg>
  ),
};
