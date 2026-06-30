import LogoSvg from "../../assets/logo.svg";

const LOGO_VIEWBOX_WIDTH = 191;
const LOGO_VIEWBOX_HEIGHT = 98;

export function Logo(props: { width?: number; height?: number }) {
  const width = props.width ?? 200;
  const height =
    props.height ?? Math.round((width * LOGO_VIEWBOX_HEIGHT) / LOGO_VIEWBOX_WIDTH);

  return (
    <LogoSvg
      width={width}
      height={height}
      viewBox={`0 0 ${LOGO_VIEWBOX_WIDTH} ${LOGO_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      accessibilityRole="image"
    />
  );
}