declare module "react-transition-group" {
  import type { ReactElement, RefObject } from "react";
  export function CSSTransition(props: {
    in: boolean;
    appear?: boolean;
    timeout: number;
    classNames: string;
    nodeRef: RefObject<HTMLElement>;
    children: ReactElement;
  }): ReactElement;
}
