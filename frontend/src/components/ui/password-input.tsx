'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, InputProps } from './input';

export function PasswordInput({ placeholder = 'Enter your password', ...props }: Omit<InputProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      placeholder={placeholder}
      suffixIcon={
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
          className="pointer-events-auto rounded p-0.5 text-text-tertiary hover:text-text-primary"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      }
    />
  );
}
