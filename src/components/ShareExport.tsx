// Share & Export toolbar — URL sharing, JSON/YAML export, JSON import
import { useRef, useState } from 'react'
import { useStore } from '../store'
import { getShareUrl, downloadJSON, exportConcourseYAML, importPipelineJSON } from '../share'

export function ShareExport() {
  const pipeline = useStore(s => s.pipeline)
  const setPipeline = useStore(s => s.setPipeline)
  const fileRef = useRef<HTMLInputElement>(null)
  const [copied, setCopied] = useState(false)
  const [yamlVisible, setYamlVisible] = useState(false)
  const [yaml, setYaml] = useState('')

  const handleCopyLink = async () => {
    const url = getShareUrl(pipeline)
    await navigator.clipboard.writeText(url)
    // Also update the URL bar
    window.location.hash = url.split('#')[1]
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportJSON = () => {
    downloadJSON(pipeline)
  }

  const handleExportYAML = () => {
    const y = exportConcourseYAML(pipeline)
    setYaml(y)
    setYamlVisible(!yamlVisible)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const result = await importPipelineJSON(file)
    if (result) {
      setPipeline(result)
    } else {
      alert('Invalid pipeline.json file')
    }
    // Reset input
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleCopyYaml = async () => {
    await navigator.clipboard.writeText(yaml)
  }

  return (
    <div className="share-export">
      <div className="share-export-row">
        <button className="btn" onClick={handleCopyLink}>
          {copied ? '\u2713 copied!' : '\uD83D\uDD17 copy link'}
        </button>
        <button className="btn" onClick={handleExportJSON}>
          {'\u2B07'} pipeline.json
        </button>
        <button className="btn" onClick={handleExportYAML}>
          {yamlVisible ? '\u2715 close' : '\u2B07'} concourse.yml
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          {'\u2B06'} import .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {yamlVisible && (
        <div className="yaml-preview">
          <div className="yaml-header">
            <span className="ctrl-lbl">Concourse YAML (read-only export)</span>
            <button className="btn btn-sm" onClick={handleCopyYaml}>copy</button>
          </div>
          <pre className="yaml-code">{yaml}</pre>
        </div>
      )}
    </div>
  )
}
