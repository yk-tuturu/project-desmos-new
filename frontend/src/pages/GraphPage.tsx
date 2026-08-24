import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

declare const Desmos: any

const BATCH_SIZE = 300

type GraphState = {
  expressions: string[]
  width?: number
  height?: number
}

// Returns a math-bounds box that fully contains the image and matches the
// graphpaper's pixel aspect ratio, so x/y units stay equal (no stretching).
function computeFittedBounds(
  width: number,
  height: number,
  graphpaperWidth: number,
  graphpaperHeight: number
) {
  const graphpaperAspect = graphpaperWidth / graphpaperHeight
  const imageAspect = width / height

  const mathWidth = imageAspect > graphpaperAspect ? width : height * graphpaperAspect
  const mathHeight = imageAspect > graphpaperAspect ? width / graphpaperAspect : height

  const xPad = (mathWidth - width) / 2
  const yPad = (mathHeight - height) / 2

  return {
    left: -xPad,
    right: width + xPad,
    bottom: -height - yPad,
    top: yPad,
  }
}

function GraphPage() {
  const { state } = useLocation() as { state: GraphState | null }
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(0)

  useEffect(() => {
    if (!containerRef.current || !state?.expressions) return

    const calculator = Desmos.GraphingCalculator(containerRef.current, {
      expressions: true,
    })

    const { width, height } = state

    function applyFittedBounds() {
      if (!width || !height) return
      // Use the graphpaper's own pixel size, not the container's — the
      // expressions list on the left eats into the container width but
      // isn't part of the drawable graph area.
      const { width: graphpaperWidth, height: graphpaperHeight } =
        calculator.graphpaperBounds.pixelCoordinates
      if (!graphpaperWidth || !graphpaperHeight) return
      calculator.setMathBounds(
        computeFittedBounds(width, height, graphpaperWidth, graphpaperHeight)
      )
    }

    applyFittedBounds()
    window.addEventListener('resize', applyFittedBounds)

    let cancelled = false
    const expressions = state.expressions

    async function loadInBatches() {
      for (let i = 0; i < expressions.length; i += BATCH_SIZE) {
        if (cancelled) return

        const batch = expressions.slice(i, i + BATCH_SIZE).map((latex, j) => ({
          id: `curve-${i + j}`,
          latex,
          color: "#000000",
        }))
        calculator.setExpressions(batch)

        // flushSync forces the DOM update to commit immediately instead of
        // being deferred/batched past the heavy setExpressions call above
        flushSync(() => {
          setLoaded(Math.min(i + BATCH_SIZE, expressions.length))
        })

        // setTimeout (a macrotask) reliably yields until after the browser
        // has painted; requestAnimationFrame only guarantees "before paint,"
        // which heavy synchronous work can still end up skipping
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    loadInBatches()

    return () => {
      cancelled = true
      window.removeEventListener('resize', applyFittedBounds)
      calculator.destroy()
    }
  }, [state])

  if (!state?.expressions) {
    return <Navigate to="/" replace />
  }

  const total = state.expressions.length
  const isLoading = loaded < total
  const progress = total === 0 ? 100 : Math.max((loaded / total) * 100, 5)

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="shrink-0 w-full z-50 shadow-sm bg-surface">
        <div className="flex items-center w-full px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto h-16">
          <button
            onClick={() => navigate('/', { replace: true })}
            className="flex items-center gap-2 text-on-surface-variant text-label-sm font-label-sm hover:text-primary transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Back to Upload
          </button>
        </div>
        <div className="w-full h-1.5 bg-surface-variant overflow-hidden">
          <div
            className="progress-bar-fill h-full transition-[width,opacity] duration-150 ease-out"
            style={{ width: `${progress}%`, opacity: isLoading ? 1 : 0 }}
          />
        </div>
      </header>

      <div className="flex-1 relative">
        <div ref={containerRef} className="absolute inset-0" />
        {isLoading && (
          <div className="fixed top-20 right-4 bg-surface-container-lowest px-4 py-2 rounded-lg shadow text-label-sm z-50">
            Loading {loaded}/{total}
          </div>
        )}
      </div>
    </div>
  )
}

export default GraphPage
