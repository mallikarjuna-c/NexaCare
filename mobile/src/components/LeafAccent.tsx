import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
  opacity?: number;
  rotation?: number; // degrees
};

export default function LeafAccent({ size = 140, color = '#3FAE6A', opacity = 0.18, rotation = 0 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ opacity, transform: [{ rotate: `${rotation}deg` }] }}
    >
      {/* Leaf body: two curves meeting at a tip and a base */}
      <Path
        d="M10 90 C10 50, 40 10, 90 10 C90 50, 60 90, 10 90 Z"
        fill={color}
      />
      {/* Center vein */}
      <Path
        d="M15 85 C35 65, 60 40, 85 15"
        stroke="#FFFFFF"
        strokeWidth={2}
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}