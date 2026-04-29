import { useState, useRef, useCallback } from 'react'
import { ImagePlus, Type, X, Upload, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TopicInputProps {
  onTopicSet: (topic: { type: 'text' | 'image'; content: string; taskType: 'task1' | 'task2' }) => void
  selectedTaskType: 'task1' | 'task2'
  onTaskTypeChange: (type: 'task1' | 'task2') => void
}

export function TopicInput({ onTopicSet, selectedTaskType, onTaskTypeChange }: TopicInputProps) {
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [textTopic, setTextTopic] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setImagePreview(result)
      onTopicSet({ type: 'image', content: result, taskType: selectedTaskType })
    }
    reader.readAsDataURL(file)
  }, [onTopicSet, selectedTaskType])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageFile(file)
  }, [handleImageFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) handleImageFile(file)
        return
      }
    }
  }, [handleImageFile])

  const handleTextSubmit = () => {
    if (textTopic.trim()) {
      onTopicSet({ type: 'text', content: textTopic.trim(), taskType: selectedTaskType })
    }
  }

  const clearImage = () => {
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Task Type Selector */}
      <div className="flex items-center gap-2 mb-4 p-1 bg-secondary/50 rounded-lg w-fit">
        <button
          onClick={() => onTaskTypeChange('task1')}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
            selectedTaskType === 'task1' 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Task 1
        </button>
        <button
          onClick={() => onTaskTypeChange('task2')}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
            selectedTaskType === 'task2' 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Task 2
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={mode === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('text')}
          className="gap-1.5"
        >
          <Type className="h-4 w-4" />
          Text Input
        </Button>
        <Button
          variant={mode === 'image' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('image')}
          className="gap-1.5"
        >
          <ImagePlus className="h-4 w-4" />
          Image Upload
        </Button>
      </div>

      {mode === 'text' ? (
        <div className="space-y-3">
          <textarea
            value={textTopic}
            onChange={(e) => setTextTopic(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste or type your IELTS writing topic here...&#10;&#10;Example: Some people believe that universities should focus on providing academic skills, while others think that universities should prepare students for their future careers. Discuss both views and give your own opinion."
            className="min-h-[160px] w-full resize-y rounded-lg border bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
          />
          <Button
            onClick={handleTextSubmit}
            disabled={!textTopic.trim()}
            className="gap-1.5"
          >
            Set Topic
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onPaste={handlePaste}
            onClick={() => fileInputRef.current?.click()}
            tabIndex={0}
            className={cn(
              "relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-all",
              isDragging ? "dropzone-active" : "border-border hover:border-muted-foreground/40"
            )}
          >
            {imagePreview ? (
              <div className="relative w-full p-4">
                <img
                  src={imagePreview}
                  alt="Uploaded IELTS topic"
                  className="mx-auto max-h-[400px] rounded-md object-contain"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearImage()
                  }}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-transform hover:scale-110"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Upload className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Drop an image here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You can also paste an image from clipboard (Ctrl+V)
                  </p>
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageFile(file)
            }}
          />
        </div>
      )}
    </div>
  )
}