import React from 'react'

import { useReactNodeView } from './useReactNodeView.js'

export type NodeViewWrapperProps =
  | {
      [Key in keyof React.JSX.IntrinsicElements]?: React.JSX.IntrinsicElements[Key] & {
        // as: React__default.ElementType<any, Key>;
        as: Key
      }
    }[keyof React.JSX.IntrinsicElements]
  | (React.JSX.IntrinsicElements['div'] & {
      as?: undefined
    })

export const NodeViewWrapper: React.FC<NodeViewWrapperProps> = React.forwardRef((props: any, ref: any) => {
  const { onDragStart } = useReactNodeView()
  const Tag = props.as || 'div'

  return (
    // @ts-ignore
    <Tag
      {...props}
      ref={ref}
      data-node-view-wrapper=""
      onDragStart={onDragStart}
      style={{
        whiteSpace: 'normal',
        ...props.style,
      }}
    />
  )
}) as any
