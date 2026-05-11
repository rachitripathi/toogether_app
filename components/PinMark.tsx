import Svg, { Path } from 'react-native-svg';

type PinMarkProps = {
  size?: number;
  color?: string;
};

export function PinMark({ size = 14, color = '#5F6B7A' }: PinMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 12V4H17V2H7V4H8V12L6 14V15H11V22H13V15H18V14L16 12Z"
        fill={color}
      />
    </Svg>
  );
}
