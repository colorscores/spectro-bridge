import { describe, it, expect } from 'vitest'
import { 
  hexToRgb, 
  getContrastColor, 
  spectralToLabASTME308 as spectralToLab, 
  labToHex 
} from '@/lib/colorUtils'

describe('Color Utilities', () => {
  describe('hexToRgb', () => {
    it('converts hex color to RGB object', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 })
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 })
    })

    it('handles hex colors without # prefix', () => {
      expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('handles 3-character hex colors', () => {
      expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('returns null for invalid hex colors', () => {
      expect(hexToRgb('invalid')).toBeNull()
      expect(hexToRgb('#GGGGGG')).toBeNull()
    })
  })

  describe('getContrastColor', () => {
    it('returns white for dark colors', () => {
      expect(getContrastColor('#000000')).toBe('#FFFFFF')
      expect(getContrastColor('#333333')).toBe('#FFFFFF')
    })

    it('returns black for light colors', () => {
      expect(getContrastColor('#FFFFFF')).toBe('#000000')
      expect(getContrastColor('#CCCCCC')).toBe('#000000')
    })

    it('handles hex colors without # prefix', () => {
      expect(getContrastColor('000000')).toBe('#FFFFFF')
      expect(getContrastColor('FFFFFF')).toBe('#000000')
    })
  })

  describe('spectralToLab', () => {
    it('converts spectral data to LAB values', () => {
      const spectralData = {
        '400': 0.1,
        '450': 0.2,
        '500': 0.3,
        '550': 0.4,
        '600': 0.5,
        '650': 0.6,
        '700': 0.7
      }

      const lab = spectralToLab(spectralData)
      
      expect(lab).toHaveProperty('L')
      expect(lab).toHaveProperty('A')
      expect(lab).toHaveProperty('B')
      expect(typeof lab.L).toBe('number')
      expect(typeof lab.A).toBe('number')
      expect(typeof lab.B).toBe('number')
    })

    it('handles empty spectral data', () => {
      const lab = spectralToLab({})
      expect(lab).toEqual({ L: 0, A: 0, B: 0 })
    })
  })

  describe('labToHex', () => {
    it('converts LAB values to hex color', () => {
      const lab = { L: 50, A: 20, B: -30 }
      const hex = labToHex(lab)
      
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i)
    })

    it('handles edge case LAB values', () => {
      expect(labToHex({ L: 0, A: 0, B: 0 })).toMatch(/^#[0-9A-F]{6}$/i)
      expect(labToHex({ L: 100, A: 0, B: 0 })).toMatch(/^#[0-9A-F]{6}$/i)
    })
  })
})