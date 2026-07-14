import { useEffect, useRef } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'

interface VirtualKeyboardProps {
  onChange: (value: string) => void
  inputName?: string
  initialValue?: string
}

export function VirtualKeyboard({ onChange, inputName = 'default', initialValue = '' }: VirtualKeyboardProps) {
  const keyboardRef = useRef<{ setInput: (v: string) => void } | null>(null)

  useEffect(() => {
    keyboardRef.current?.setInput(initialValue)
  }, [inputName, initialValue])

  return (
    <div className="mt-4 rounded-xl bg-slate-100 p-2">
      <Keyboard
        keyboardRef={(r) => {
          keyboardRef.current = r as { setInput: (v: string) => void }
        }}
        onChange={onChange}
        theme="hg-theme-default hg-layout-default"
        layout={{
          default: [
            '1 2 3 4 5 6 7 8 9 0',
            'q w e r t y u i o p',
            'a s d f g h j k l',
            '{shift} z x c v b n m {backspace}',
            '{space}',
          ],
        }}
        display={{ '{space}': 'space', '{backspace}': '⌫', '{shift}': '⇧' }}
      />
    </div>
  )
}
