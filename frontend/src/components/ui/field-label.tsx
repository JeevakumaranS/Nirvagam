import React from 'react';

interface FieldLabelProps {
  htmlFor?: string;
  id?: string;
  label: string;
  className: string;
}

export function FieldLabel({ htmlFor, id, label, className }: FieldLabelProps) {
  const isRequired = label.endsWith(' *');

  return (
    <label htmlFor={htmlFor} id={id} className={className}>
      {isRequired ? (
        <>
          {label.slice(0, -2)}
          {' '}
          <span className="text-danger">*</span>
        </>
      ) : (
        label
      )}
    </label>
  );
}
