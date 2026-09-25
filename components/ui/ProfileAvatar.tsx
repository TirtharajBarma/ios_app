import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  Polygon,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AVATAR_OPTIONS, AvatarOption } from '@/constants/avatars';
import AppText from './AppText';

interface ProfileAvatarProps {
  avatarId?: string | null;
  name?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showBorder?: boolean;
}

/**
 * Custom vector graphics for 16 bespoke avatars (ViewBox 0 0 48 48)
 */
function renderAvatarSvg(avatarId: string, accentColor: string, secondaryColor: string) {
  switch (avatarId) {
    case 'avatar_solaris':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          <Circle cx="24" cy="24" r="7" fill={accentColor} />
          {/* 8 Geometric Sun Rays */}
          <Path d="M24 6L26.5 12H21.5L24 6Z" fill={accentColor} />
          <Path d="M24 42L21.5 36H26.5L24 42Z" fill={accentColor} />
          <Path d="M6 24L12 21.5V26.5L6 24Z" fill={accentColor} />
          <Path d="M42 24L36 26.5V21.5L42 24Z" fill={accentColor} />
          <Path d="M11.3 11.3L17.5 13.5L13.5 17.5L11.3 11.3Z" fill={secondaryColor} />
          <Path d="M36.7 11.3L34.5 17.5L30.5 13.5L36.7 11.3Z" fill={secondaryColor} />
          <Path d="M36.7 36.7L30.5 34.5L34.5 30.5L36.7 36.7Z" fill={secondaryColor} />
          <Path d="M11.3 36.7L13.5 30.5L17.5 34.5L11.3 36.7Z" fill={secondaryColor} />
        </Svg>
      );

    case 'avatar_aegis':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          <Path
            d="M24 6L38 12V24C38 32.5 32 39.5 24 42C16 39.5 10 32.5 10 24V12L24 6Z"
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <Path
            d="M24 12L33 16.5V24C33 30 29 35 24 37C19 35 15 30 15 24V16.5L24 12Z"
            fill={secondaryColor}
            opacity="0.3"
          />
          <Circle cx="24" cy="24" r="3.5" fill={accentColor} />
          <Path d="M24 16V20.5M24 27.5V32M17 24H20.5M27.5 24H31" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );

    case 'avatar_falcon':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Main Body & Head */}
          <Polygon points="24,9 28,17 24,22 20,17" fill={accentColor} />
          {/* Left Wing Facets */}
          <Polygon points="20,17 7,16 16,25 20,22" fill={secondaryColor} />
          <Polygon points="16,25 9,28 18,33 21,27" fill={accentColor} opacity="0.8" />
          {/* Right Wing Facets */}
          <Polygon points="28,17 41,16 32,25 28,22" fill={secondaryColor} />
          <Polygon points="32,25 39,28 30,33 27,27" fill={accentColor} opacity="0.8" />
          {/* Tail */}
          <Polygon points="24,25 21,39 24,37 27,39" fill={accentColor} />
        </Svg>
      );

    case 'avatar_zenith':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Center Petal */}
          <Path d="M24 10C24 10 29 18 29 26C29 31 24 35 24 35C24 35 19 31 19 26C19 18 24 10 24 10Z" fill={accentColor} />
          {/* Left Petal */}
          <Path d="M24 20C24 20 15 22 13 28C11 34 16 38 21 37C21 37 19 31 24 28V20Z" fill={secondaryColor} opacity="0.8" />
          {/* Right Petal */}
          <Path d="M24 20C24 20 33 22 35 28C37 34 32 38 27 37C27 37 29 31 24 28V20Z" fill={secondaryColor} opacity="0.8" />
          {/* Outer Base Accent */}
          <Circle cx="24" cy="38" r="2" fill={accentColor} />
        </Svg>
      );

    case 'avatar_prism':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          <Polygon points="24,8 38,18 38,30 24,40 10,30 10,18" stroke={accentColor} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
          {/* Inner Facets */}
          <Polygon points="24,8 24,40 38,18" fill={secondaryColor} opacity="0.4" />
          <Polygon points="24,8 10,18 24,40" fill={accentColor} opacity="0.25" />
          <Polygon points="24,8 38,30 10,30" fill={secondaryColor} opacity="0.3" />
          <Circle cx="24" cy="24" r="3" fill="#FFFFFF" />
        </Svg>
      );

    case 'avatar_orbit':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Center Celestial Core */}
          <Circle cx="24" cy="24" r="6" fill={accentColor} />
          {/* Elliptical Ring 1 */}
          <G transform="rotate(45 24 24)">
            <Path d="M6 24C6 17.5 14 12 24 12C34 12 42 17.5 42 24C42 30.5 34 36 24 36C14 36 6 30.5 6 24Z" stroke={secondaryColor} strokeWidth="2" strokeDasharray="4 2" />
            <Circle cx="39" cy="24" r="2.5" fill="#FFFFFF" />
          </G>
          {/* Elliptical Ring 2 */}
          <G transform="rotate(-45 24 24)">
            <Path d="M6 24C6 17.5 14 12 24 12C34 12 42 17.5 42 24C42 30.5 34 36 24 36C14 36 6 30.5 6 24Z" stroke={accentColor} strokeWidth="2" />
            <Circle cx="9" cy="24" r="2.5" fill={accentColor} />
          </G>
        </Svg>
      );

    case 'avatar_kitsune':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Left Ear */}
          <Polygon points="12,8 20,18 10,22" fill={secondaryColor} />
          {/* Right Ear */}
          <Polygon points="36,8 38,22 28,18" fill={secondaryColor} />
          {/* Crown Forehead */}
          <Polygon points="24,14 31,22 24,26 17,22" fill={accentColor} />
          {/* Left Cheek */}
          <Polygon points="17,22 24,26 21,34 9,25" fill={accentColor} opacity="0.9" />
          {/* Right Cheek */}
          <Polygon points="31,22 39,25 27,34 24,26" fill={accentColor} opacity="0.9" />
          {/* Snout */}
          <Polygon points="24,26 27,34 24,40 21,34" fill="#FFFFFF" />
          {/* Nose */}
          <Circle cx="24" cy="38" r="1.5" fill="#1A1512" />
        </Svg>
      );

    case 'avatar_monarch':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Crown Base Bar */}
          <Rect x="10" y="32" width="28" height="5" rx="2" fill={accentColor} />
          {/* Crown Spires */}
          <Polygon points="12,32 10,18 17,26" fill={secondaryColor} />
          <Polygon points="17,26 24,12 31,26" fill={accentColor} />
          <Polygon points="31,26 38,18 36,32" fill={secondaryColor} />
          {/* Crown Jewels */}
          <Circle cx="10" cy="16" r="2" fill="#FFFFFF" />
          <Circle cx="24" cy="10" r="2.5" fill="#FFFFFF" />
          <Circle cx="38" cy="16" r="2" fill="#FFFFFF" />
        </Svg>
      );

    case 'avatar_cipher':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Top-Left Bracket */}
          <Path d="M8 17V10H17" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Top-Right Bracket */}
          <Path d="M31 10H40V17" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Bottom-Left Bracket */}
          <Path d="M8 31V38H17" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Bottom-Right Bracket */}
          <Path d="M31 38H40V31" stroke={accentColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Central Monolith & Quantum Ring */}
          <Rect x="18" y="18" width="12" height="12" rx="3" fill={secondaryColor} />
          <Circle cx="24" cy="24" r="3" fill="#FFFFFF" />
        </Svg>
      );

    case 'avatar_nebula':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          <Circle cx="24" cy="24" r="17" stroke={secondaryColor} strokeWidth="1.5" opacity="0.4" strokeDasharray="3 3" />
          <Circle cx="24" cy="24" r="12" stroke={accentColor} strokeWidth="2" opacity="0.7" />
          <Circle cx="24" cy="24" r="6" fill={accentColor} />
          <Path d="M24 6V10M24 38V42M6 24H10M38 24H42" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
          <Circle cx="24" cy="24" r="2" fill="#FFFFFF" />
        </Svg>
      );

    case 'avatar_vault':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Outer Hexagon */}
          <Polygon points="24,7 39,15.5 39,32.5 24,41 9,32.5 9,15.5" stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round" />
          {/* Inner Vault Wheel */}
          <Circle cx="24" cy="24" r="9" stroke={secondaryColor} strokeWidth="2" />
          <Circle cx="24" cy="24" r="4" fill={accentColor} />
          {/* Locking Bolt Spokes */}
          <Path d="M24 15V11M24 33V37M15 24H11M33 24H37" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        </Svg>
      );

    case 'avatar_quasar':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* 4-Point Primary Star */}
          <Path d="M24 6C24 16 28 20 38 24C28 28 24 32 24 42C24 32 20 28 10 24C20 20 24 16 24 6Z" fill={accentColor} />
          {/* 4-Point Secondary Diagonal Flares */}
          <Path d="M24 14C24 20 26 22 32 24C26 26 24 28 24 34C24 28 22 26 16 24C22 22 24 20 24 14Z" fill="#FFFFFF" opacity="0.6" />
          <Circle cx="24" cy="24" r="2.5" fill="#FFFFFF" />
        </Svg>
      );

    case 'avatar_chronos':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          <Circle cx="24" cy="24" r="16" stroke={accentColor} strokeWidth="2.5" />
          {/* 12, 3, 6, 9 Markers */}
          <Rect x="23" y="10" width="2" height="4" rx="1" fill={accentColor} />
          <Rect x="23" y="34" width="2" height="4" rx="1" fill={accentColor} />
          <Rect x="10" y="23" width="4" height="2" rx="1" fill={accentColor} />
          <Rect x="34" y="23" width="4" height="2" rx="1" fill={accentColor} />
          {/* Precision Clock Hands */}
          <Path d="M24 24L24 15" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M24 24L31 24" stroke={secondaryColor} strokeWidth="2" strokeLinecap="round" />
          <Circle cx="24" cy="24" r="2.5" fill={accentColor} />
        </Svg>
      );

    case 'avatar_abyss':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Wave 1 */}
          <Path d="M8 18C12 14 18 14 24 18C30 22 36 22 40 18" stroke={secondaryColor} strokeWidth="3" strokeLinecap="round" />
          {/* Wave 2 */}
          <Path d="M8 24C12 20 18 20 24 24C30 28 36 28 40 24" stroke={accentColor} strokeWidth="3.5" strokeLinecap="round" />
          {/* Wave 3 */}
          <Path d="M8 30C12 26 18 26 24 30C30 34 36 34 40 30" stroke={secondaryColor} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        </Svg>
      );

    case 'avatar_titan':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          {/* Left Pillar */}
          <Rect x="10" y="18" width="7" height="20" rx="3" fill={secondaryColor} />
          {/* Center Tall Monolith */}
          <Rect x="20.5" y="10" width="7" height="28" rx="3" fill={accentColor} />
          {/* Right Pillar */}
          <Rect x="31" y="18" width="7" height="20" rx="3" fill={secondaryColor} />
          <Circle cx="24" cy="15" r="2" fill="#FFFFFF" />
        </Svg>
      );

    case 'avatar_continuum':
    default:
      return (
        <Svg width="100%" height="100%" viewBox="0 0 48 48" fill="none">
          <Path
            d="M16 18C11.5 18 8 20.5 8 24C8 27.5 11.5 30 16 30C22 30 26 18 32 18C36.5 18 40 20.5 40 24C40 27.5 36.5 30 32 30C26 30 22 18 16 18Z"
            stroke={accentColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="16" cy="24" r="2.5" fill="#FFFFFF" />
          <Circle cx="32" cy="24" r="2.5" fill={secondaryColor} />
        </Svg>
      );
  }
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  avatarId,
  name,
  size = 48,
  style,
  showBorder = true,
}) => {
  const avatar = AVATAR_OPTIONS.find((a) => a.id === avatarId) || AVATAR_OPTIONS[0];

  const svgInnerSize = Math.round(size * 0.62);

  // If no avatar matched, show clean initials fallback
  if (!avatar) {
    const initials = (name || 'U')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#1E222D',
            borderColor: '#373D52',
            borderWidth: showBorder ? 1.5 : 0,
          },
          style,
        ]}
      >
        <AppText style={{ color: '#E2E8F0', fontSize: size * 0.38, fontWeight: '700' }}>
          {initials}
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatar.bgColor,
          borderColor: showBorder ? `${avatar.accentColor}55` : 'transparent',
          borderWidth: showBorder ? 1.5 : 0,
        },
        style,
      ]}
    >
      {/* Ambient Inner Glow */}
      <View
        style={[
          styles.innerGlow,
          {
            width: size * 0.85,
            height: size * 0.85,
            borderRadius: (size * 0.85) / 2,
            backgroundColor: `${avatar.accentColor}15`,
          },
        ]}
      />

      {/* Bespoke Vector Illustration */}
      <View style={{ width: svgInnerSize, height: svgInnerSize, alignItems: 'center', justifyContent: 'center' }}>
        {renderAvatarSvg(avatar.id, avatar.accentColor, avatar.secondaryColor)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  innerGlow: {
    position: 'absolute',
  },
});

export default ProfileAvatar;
