'use client';

import React from 'react';

interface InputProps {
  type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

export function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  disabled = false,
  required = false,
  className = '',
  id,
  name,
}: InputProps) {
  const baseClasses = 'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      className={`${baseClasses} ${className}`}
      id={id}
      name={name}
    />
  );
}