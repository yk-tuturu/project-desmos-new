import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const TRACE_URL = `${API_BASE_URL}/trace`
const PRESETS_URL = `${API_BASE_URL}/presets`

type DetailLevel = 'low' | 'medium' | 'high'
type LineStyle = 'sharp' | 'balanced' | 'smooth'

type DetailPreset = {
  resizeWidth: number
  cannyLow: number
  cannyHigh: number
  turdSize: number
  optTolerance: number
  minCurveLength: number
}

type Presets = {
  detailPresets: Record<DetailLevel, DetailPreset>
  lineStylePresets: Record<LineStyle, number>
}

type AdvancedSettings = DetailPreset & { alphaMax: number }

const DETAIL_OPTIONS: { value: DetailLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const LINE_STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'smooth', label: 'Smooth' },
]

const DEFAULT_ADVANCED: AdvancedSettings = {
  resizeWidth: 800,
  cannyLow: 50,
  cannyHigh: 120,
  turdSize: 5,
  optTolerance: 0.4,
  minCurveLength: 3,
  alphaMax: 1,
}

function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageWidth, setImageWidth] = useState<number | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [detail, setDetail] = useState<DetailLevel>('medium')
  const [lineStyle, setLineStyle] = useState<LineStyle>('balanced')
  const [advancedMode, setAdvancedMode] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<DetailLevel>('medium')
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_ADVANCED)
  const [presets, setPresets] = useState<Presets | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(PRESETS_URL)
      .then((res) => res.json())
      .then(setPresets)
      .catch((error) => console.error('Failed to load presets:', error))
  }, [])

  // Once the actual image width is known, keep the resize slider in bounds.
  useEffect(() => {
    if (!imageWidth) return
    setAdvanced((prev) => ({ ...prev, resizeWidth: Math.min(prev.resizeWidth, imageWidth) }))
  }, [imageWidth])

  function handleFileChange(file: File | null) {
    setSelectedFile(file)
    setImageWidth(null)
    if (!file) return

    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      setImageWidth(img.naturalWidth)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  function applyPreset(level: DetailLevel) {
    setSelectedPreset(level)
    if (!presets) return
    const detailPreset = presets.detailPresets[level]
    setAdvanced({
      ...detailPreset,
      resizeWidth: imageWidth ? Math.min(detailPreset.resizeWidth, imageWidth) : detailPreset.resizeWidth,
      alphaMax: presets.lineStylePresets[lineStyle],
    })
  }

  function toggleAdvancedMode() {
    const next = !advancedMode
    setAdvancedMode(next)
    if (next) applyPreset(detail)
  }

  async function handleRender() {
    if (!selectedFile || isRendering) return

    setIsRendering(true)
    try {
      const formData = new FormData()
      formData.append('image', selectedFile)

      if (advancedMode) {
        formData.append('resizeWidth', String(advanced.resizeWidth))
        formData.append('cannyLow', String(advanced.cannyLow))
        formData.append('cannyHigh', String(advanced.cannyHigh))
        formData.append('turdSize', String(advanced.turdSize))
        formData.append('optTolerance', String(advanced.optTolerance))
        formData.append('minCurveLength', String(advanced.minCurveLength))
        formData.append('alphaMax', String(advanced.alphaMax))
      } else {
        formData.append('detail', detail)
        formData.append('lineStyle', lineStyle)
      }

      const response = await fetch(TRACE_URL, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Trace request failed: ${response.status}`)
      }

      const data = await response.json()
      navigate('/graph', {
        state: { expressions: data.expressions, width: data.width, height: data.height },
      })
    } catch (error) {
      console.error('Failed to trace image:', error)
    } finally {
      setIsRendering(false)
    }
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col relative overflow-x-hidden font-body-md text-body-md">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 z-0 pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-fixed-dim rounded-full blur-[120px] opacity-20 -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-fixed-dim rounded-full blur-[120px] opacity-20 -z-10 pointer-events-none" />

      {/* Top Nav Bar */}
      <header className="fixed top-0 w-full z-50 shadow-sm bg-surface">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto h-16">
          <div className="flex items-center gap-8">
            <a
              className="text-headline-md font-headline-md font-bold text-primary tracking-tight"
              href="#"
            >
              Project Desmos
            </a>
            <nav className="hidden md:flex gap-6">
              <a
                className="text-on-surface-variant text-label-sm font-label-sm hover:text-primary transition-colors duration-200"
                href="#"
              >
                How it Works
              </a>
              <a
                className="text-on-surface-variant text-label-sm font-label-sm hover:text-primary transition-colors duration-200"
                href="#"
              >
                Tutorials
              </a>
              <a
                className="text-on-surface-variant text-label-sm font-label-sm hover:text-primary transition-colors duration-200"
                href="#"
              >
                Pricing
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <a
              className="hidden md:block text-primary text-label-sm font-label-sm hover:text-primary-container transition-colors duration-200"
              href="#"
            >
              Sign In
            </a>
            <a
              className="bg-primary text-on-primary text-label-sm font-label-sm px-4 py-2 rounded-lg hover:bg-primary-container transition-colors duration-200 shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
              href="#"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col items-center justify-center pt-32 pb-24 px-margin-mobile md:px-margin-desktop relative z-10 w-full max-w-container-max-width mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16 max-w-3xl mx-auto space-y-6">
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg text-on-primary-fixed">
            Turn Pixels into Equations
          </h1>
          <p className="text-body-lg font-body-lg text-on-surface-variant max-w-2xl mx-auto">
            Upload any image and instantly convert it into a precise,
            rendering-ready mathematical formula for Desmos. Precision math
            meets creative vision.
          </p>
        </div>

        {/* Main Feature: Upload Dialog Box */}
        <div className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-[0_8px_24px_rgba(59,130,246,0.08)] border border-outline-variant p-gutter">
          {/* Drag & Drop Area */}
          <div className="border-2 border-dashed border-outline-variant rounded-xl p-12 flex flex-col items-center justify-center text-center bg-surface-container-low hover:border-primary hover:bg-primary-fixed transition-colors duration-300 cursor-pointer group mb-8">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            <span className="material-symbols-outlined text-4xl text-outline group-hover:text-primary mb-4 transition-colors duration-300">
              cloud_upload
            </span>
            <p className="text-body-md font-body-md text-on-surface mb-2 font-medium">
              {selectedFile ? selectedFile.name : 'Drag and drop your image here'}
            </p>
            <p className="text-label-sm font-label-sm text-on-surface-variant">
              PNG, JPG, SVG up to 10MB
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 px-6 py-2 border border-outline-variant rounded-lg text-label-sm font-label-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors duration-200 bg-surface-container-lowest"
            >
              Browse Files
            </button>
          </div>

          {/* Adjustments Panel */}
          <div className="space-y-6 mb-8">
            <div className="flex items-center justify-between mb-4 border-b border-surface-variant pb-2">
              <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Conversion Parameters
              </h3>
              <button
                type="button"
                onClick={toggleAdvancedMode}
                className="flex items-center gap-2"
              >
                <span className="text-label-sm font-label-sm text-on-surface-variant">
                  Advanced
                </span>
                <span
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                    advancedMode ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-surface-container-lowest rounded-full shadow-sm transition-transform duration-200 ${
                      advancedMode ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </button>
            </div>

            {advancedMode ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-label-sm font-label-sm text-on-surface">
                    Preset
                  </label>
                  <div className="flex gap-2">
                    {DETAIL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => applyPreset(option.value)}
                        className={`flex-1 py-2 rounded-lg text-label-sm font-label-sm border transition-colors duration-200 ${
                          selectedPreset === option.value
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <SliderControl
                  label="Resize Width"
                  value={advanced.resizeWidth}
                  min={500}
                  max={Math.max(imageWidth ?? 1800, 500)}
                  onChange={(value) => setAdvanced((prev) => ({ ...prev, resizeWidth: value }))}
                  formatValue={(value) => `${value}px`}
                />
                <SliderControl
                  label="Canny Low Threshold"
                  value={advanced.cannyLow}
                  min={0}
                  max={200}
                  onChange={(value) => setAdvanced((prev) => ({ ...prev, cannyLow: value }))}
                />
                <SliderControl
                  label="Canny High Threshold"
                  value={advanced.cannyHigh}
                  min={50}
                  max={400}
                  onChange={(value) => setAdvanced((prev) => ({ ...prev, cannyHigh: value }))}
                />
                <SliderControl
                  label="Speckle Suppression"
                  value={advanced.turdSize}
                  min={0}
                  max={20}
                  onChange={(value) => setAdvanced((prev) => ({ ...prev, turdSize: value }))}
                />
                <SliderControl
                  label="Curve Simplification"
                  value={advanced.optTolerance}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(value) => setAdvanced((prev) => ({ ...prev, optTolerance: value }))}
                  formatValue={(value) => value.toFixed(2)}
                />
                <SliderControl
                  label="Min Curve Length"
                  value={advanced.minCurveLength}
                  min={1}
                  max={5}
                  onChange={(value) => setAdvanced((prev) => ({ ...prev, minCurveLength: value }))}
                />
                <SliderControl
                  label="Corner Smoothness"
                  value={advanced.alphaMax}
                  min={0}
                  max={1.34}
                  step={0.02}
                  onChange={(value) => setAdvanced((prev) => ({ ...prev, alphaMax: value }))}
                  formatValue={(value) => value.toFixed(2)}
                />
              </div>
            ) : (
              <>
                <OptionSelector
                  label="Detail Level"
                  options={DETAIL_OPTIONS}
                  value={detail}
                  onChange={setDetail}
                />
                <OptionSelector
                  label="Line Style"
                  options={LINE_STYLE_OPTIONS}
                  value={lineStyle}
                  onChange={setLineStyle}
                />
              </>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleRender}
            disabled={!selectedFile || isRendering}
            className="w-full py-4 rounded-xl text-on-primary font-headline-md text-[18px] font-semibold tracking-wide bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity duration-300 shadow-[0_8px_24px_rgba(107,56,212,0.3)] hover:shadow-[0_12px_32px_rgba(107,56,212,0.4)] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-xl group-hover:rotate-180 transition-transform duration-500">
              functions
            </span>
            {isRendering ? 'Rendering...' : 'Render in Desmos'}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low border-t border-outline-variant mt-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-8 max-w-container-max-width mx-auto gap-6 md:gap-0">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="text-headline-md font-headline-md font-bold text-primary">
              Project Desmos
            </span>
            <p className="text-body-md font-body-md text-on-surface-variant text-sm text-center md:text-left">
              © 2026 Project Desmos. Precision math meets creative vision.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a
              className="text-label-sm font-label-sm text-on-surface-variant hover:text-secondary transition-colors hover:underline"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="text-label-sm font-label-sm text-on-surface-variant hover:text-secondary transition-colors hover:underline"
              href="#"
            >
              Terms of Service
            </a>
            <a
              className="text-label-sm font-label-sm text-on-surface-variant hover:text-secondary transition-colors hover:underline"
              href="#"
            >
              API Documentation
            </a>
            <a
              className="text-label-sm font-label-sm text-on-surface-variant hover:text-secondary transition-colors hover:underline"
              href="#"
            >
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function OptionSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-label-sm font-label-sm text-on-surface">
        {label}
      </label>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 py-2 rounded-lg text-label-sm font-label-sm border transition-colors duration-200 ${
              value === option.value
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-primary'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-label-sm font-label-sm text-on-surface">
          {label}
        </label>
        <span className="text-label-sm font-label-sm text-secondary font-medium">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

export default UploadPage
