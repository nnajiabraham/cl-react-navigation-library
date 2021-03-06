import React, { Component, createContext, Children, cloneElement } from 'react';
import {
  BasepathContext,
  NavigationProvider,
  NavigationProps,
  LocationContext,
  RootNavigateContext,
  BackContext,
} from './navigation-provider';
import { Back, NavigateOptions } from './navigation';
import { Screen } from './screen';

const NOOP = () => {};

export interface NavigatorState {
  activeIndex: number;
  onChange: (nextIndex: number) => void;
  state: Object;
  defaultIndex: number;
  renderScreens: (
    isScreenActive: (childIndex: number, childElement: any) => boolean,
    children: any
  ) => any;
}

export const NavigatorContext = createContext<NavigatorState>({
  activeIndex: 0,
  defaultIndex: 0,
  onChange: () => {
    throw new Error('onChange not set!');
  },
  state: {},
  renderScreens: NOOP,
});

type NavigateFn = (
  to: string,
  state?: Object,
  options?: NavigateOptions
) => void;

export const NavigateContext = createContext<NavigateFn>(NOOP);

interface RenderProps {
  activeIndex: number;
  state: any;
  navigate: (to: string, state: any) => void;
  back: (steps: number) => void;
  location: string;
}

type RenderProp = (props: RenderProps) => any;
export type NavigatorChild = React.ReactNode | RenderProp;

interface NavigatorImplProps {
  children: NavigatorChild;
  basepath: string;
  location: string;
  routes: string[];
  defaultIndex: number;
  navigate: NavigateFn;
  back: Back;
  initialState: Object;
}

class NavigatorImpl extends Component<NavigatorImplProps, NavigatorState> {
  handleChange = (nextIndex: number) => {
    const { location, basepath, routes } = this.props;
    const { activeIndex } = this.state;

    // is not focused so we shouldnt push this view
    if (activeIndex !== -1 && activeIndex !== nextIndex) {
      const next = routes[nextIndex];

      if (next) {
        const pathname = getPathname(next, basepath);
        const nextPath = resolveParams(pathname, location);
        this.navigate(nextPath);
      }
    }
  };

  getActiveIndex = () => {
    const { basepath, location, routes } = this.props;

    let activeIndex = -1;

    for (let i = 0; i < routes.length; i++) {
      const path = routes[i];
      const pathname = getPathname(path, basepath);
      const isMatch = match(pathname, location);

      if (isMatch) {
        // root path is greedy -- prevent it from matching over others previous to it
        if (path !== '/') {
          activeIndex = i;
        }

        if (path === '/' && activeIndex === -1) {
          activeIndex = i;
        }
      }
    }

    return activeIndex;
  };

  setNavigatorState = (newState: Object) => {
    this.setState((state: NavigatorState) => {
      return {
        ...state,
        state: {
          ...state.state,
          ...newState,
        },
      };
    });
  };

  navigate = (to: string, state?: Object, options?: NavigateOptions) => {
    const { basepath, navigate } = this.props;

    if (state) {
      this.setNavigatorState({ ...state });
    }

    navigate(to, basepath, options);
  };

  renderScreens = (
    isScreenActive: (childIndex: number, childElement: any) => boolean,
    children: any
  ) => {
    const { basepath, location, routes } = this.props;
    const query = getQuery(location);

    return Children.map(children, (element: any, index: number) => {
      const path = segmentize(routes[index]).join('/');
      const pathname = getPathname(path || '/', basepath);
      const active = isScreenActive(index, element);
      const params = getParams(pathname, location);

      return (
        <Screen active={active} path={pathname}>
          {cloneElement(element, { ...params, query, path })}
        </Screen>
      );
    });
  };

  static defaultProps = {
    initialState: {},
    defaultIndex: 0,
  };

  state = {
    activeIndex: this.getActiveIndex(),
    defaultIndex: this.props.defaultIndex,
    onChange: this.handleChange,
    state: this.props.initialState,
    renderScreens: this.renderScreens,
  };

  componentDidUpdate(prevProps: NavigatorImplProps) {
    if (prevProps.location !== this.props.location) {
      const activeIndex = this.getActiveIndex();

      if (activeIndex !== this.state.activeIndex) {
        this.setState({ activeIndex });
      }
    }
  }

  render() {
    const { children, location, back } = this.props;

    let c = children;

    if (typeof children === 'function') {
      // @ts-ignore
      c = children({
        activeIndex: this.state.activeIndex,
        state: this.state.state,
        navigate: this.navigate,
        back: back,
        location,
      });
    }

    return (
      <NavigateContext.Provider value={this.navigate}>
        <NavigatorContext.Provider value={this.state}>
          {c}
        </NavigatorContext.Provider>
      </NavigateContext.Provider>
    );
  }
}

interface NavigatorProps {
  initialState?: Object;
  defaultIndex?: number;
  routes: string[];
}

function Navigator({
  children,
  initialState,
  defaultIndex,
  routes,
  ...rest
}: NavigationProps & NavigatorProps & { children: NavigatorChild }) {
  return (
    <BasepathContext.Consumer>
      {(basepath = '/') => (
        <NavigationProvider {...rest}>
          <LocationContext.Consumer>
            {location => (
              <BackContext.Consumer>
                {back => (
                  <RootNavigateContext.Consumer>
                    {navigate => (
                      <NavigatorImpl
                        routes={routes}
                        defaultIndex={defaultIndex}
                        initialState={initialState}
                        location={location}
                        navigate={navigate}
                        back={back}
                        basepath={basepath}
                      >
                        {children}
                      </NavigatorImpl>
                    )}
                  </RootNavigateContext.Consumer>
                )}
              </BackContext.Consumer>
            )}
          </LocationContext.Consumer>
        </NavigationProvider>
      )}
    </BasepathContext.Consumer>
  );
}

export { Navigator };

export function getPathname(path: string, basepath: string): string {
  if (path === '/' || path === '') {
    return basepath;
  }

  return `${basepath === '/' ? '' : basepath}/${path}`;
}

let paramRe = /^:(.+)/;

function resolveParams(pathname: string, location: string): string {
  let l = location;

  if (location.includes('?')) {
    l = location.split('?')[0];
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  const locationSegments = l.split('/').filter(Boolean);

  let segments: string[] = [];

  for (let i = 0; i < pathSegments.length; i++) {
    let subpath = pathSegments[i];
    const isDynamic = paramRe.exec(subpath);

    if (isDynamic) {
      subpath = locationSegments[i];
    }

    segments.push(subpath);
  }

  return '/' + segments.join('/');
}

function match(pathname: string, location: string): boolean {
  // if (exact && pathSegments.length !== locationSegments.length) {
  //   return false;
  // }

  if (pathname === '/') {
    return true;
  }

  let l = location;

  if (location.includes('?')) {
    l = location.split('?')[0];
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  const locationSegments = l.split('/').filter(Boolean);

  if (pathSegments.length > locationSegments.length) {
    return false;
  }

  let match = true;

  for (let i = 0; i < pathSegments.length; i++) {
    const subpath = pathSegments[i];

    const isDynamic = paramRe.exec(subpath);

    if (subpath !== '/') {
      if (!isDynamic && subpath !== locationSegments[i]) {
        match = false;
        break;
      }

      if (isDynamic && locationSegments[i] === '') {
        match = false;
        break;
      }
    }
  }

  return match;
}

function segmentize(uri: string): string[] {
  // strip starting/ending slashes
  return uri.replace(/(^\/+|\/+$)/g, '').split('/');
}

function getParams(
  pathname: string,
  location: string
): { [param: string]: string } | undefined {
  let params: { [param: string]: string } | undefined;

  const pathSegments = pathname.split('/');
  const locationSegments = location.split('/');

  for (let i = 0; i < pathSegments.length; i++) {
    const paramsMatch = paramRe.exec(pathSegments[i]);
    if (paramsMatch) {
      if (!params) {
        params = {};
      }

      params[paramsMatch[1]] = locationSegments[i];
    }
  }

  return params;
}

function getQuery(location: string): string {
  const [, query] = location.split('?');
  return query || '';
}
