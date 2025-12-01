import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  createTestCxfFile, 
  testFileReaderAPI, 
  readFileAsText,
  runFileSystemDiagnostics 
} from '@/lib/fileTestUtils'

describe('File Test Utils', () => {
  beforeEach(() => {
    // Mock FileReader for tests
    global.FileReader = class MockFileReader {
      constructor() {
        this.readyState = 0
        this.result = null
        this.error = null
        this.onload = null
        this.onerror = null
      }

      readAsText(file) {
        setTimeout(() => {
          this.readyState = 2
          this.result = '<CxF>Mock CXF Content</CxF>'
          if (this.onload) this.onload({ target: this })
        }, 0)
      }
    }
  })

  describe('createTestCxfFile', () => {
    it('creates a valid CXF file object', () => {
      const file = createTestCxfFile()
      
      expect(file).toBeInstanceOf(File)
      expect(file.name).toBe('test-colors.cxf')
      expect(file.type).toBe('application/xml')
      expect(file.size).toBeGreaterThan(0)
    })

    it('creates CXF file with XML content', async () => {
      const file = createTestCxfFile()
      const text = await file.text()
      
      expect(text).toContain('<CxF')
      expect(text).toContain('</CxF>')
      expect(text).toContain('<ColorSpecification')
    })
  })

  describe('testFileReaderAPI', () => {
    it('returns successful test results when FileReader is available', async () => {
      const results = await testFileReaderAPI()
      
      expect(results.fileReaderAvailable).toBe(true)
      expect(results.canCreateFileReader).toBe(true)
      expect(results.canReadBlob).toBe(true)
      expect(results.canReadFile).toBe(true)
      expect(results.environment).toBe('jsdom')
    })

    it('handles FileReader errors gracefully', async () => {
      // Mock FileReader that throws error
      global.FileReader = class ErrorFileReader {
        constructor() {
          throw new Error('FileReader not supported')
        }
      }

      const results = await testFileReaderAPI()
      
      expect(results.fileReaderAvailable).toBe(true) // Constructor exists
      expect(results.canCreateFileReader).toBe(false)
      expect(results.canReadBlob).toBe(false)
      expect(results.canReadFile).toBe(false)
    })
  })

  describe('readFileAsText', () => {
    it('successfully reads file content', async () => {
      const file = createTestCxfFile()
      const content = await readFileAsText(file)
      
      expect(typeof content).toBe('string')
      expect(content).toContain('<CxF')
    })

    it('handles file reading errors', async () => {
      global.FileReader = class ErrorFileReader {
        readAsText() {
          setTimeout(() => {
            this.error = new Error('Failed to read file')
            if (this.onerror) this.onerror({ target: this })
          }, 0)
        }
      }

      const file = createTestCxfFile()
      
      await expect(readFileAsText(file)).rejects.toThrow('Failed to read file')
    })
  })

  describe('runFileSystemDiagnostics', () => {
    it('runs comprehensive file system diagnostics', async () => {
      const diagnostics = await runFileSystemDiagnostics()
      
      expect(diagnostics).toHaveProperty('fileReaderTest')
      expect(diagnostics).toHaveProperty('fileInputTest')
      expect(diagnostics).toHaveProperty('securityContext')
      expect(diagnostics).toHaveProperty('timestamp')
      
      expect(diagnostics.fileReaderTest.fileReaderAvailable).toBe(true)
      expect(diagnostics.securityContext.protocol).toBe('http:')
    })

    it('includes browser environment information', async () => {
      const diagnostics = await runFileSystemDiagnostics()
      
      expect(diagnostics.fileReaderTest.environment).toBe('jsdom')
      expect(diagnostics.securityContext).toHaveProperty('userAgent')
      expect(diagnostics.securityContext).toHaveProperty('cookieEnabled')
    })
  })
})