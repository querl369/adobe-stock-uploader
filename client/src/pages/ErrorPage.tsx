import { useRouteError, isRouteErrorResponse } from 'react-router';

export function ErrorPage() {
  const error = useRouteError();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="tracking-[-0.04em] opacity-95 text-[clamp(1.5rem,3vw,2rem)] leading-[1.1]">
          {isRouteErrorResponse(error) ? `${error.status}` : 'Error'}
        </h1>
        <p className="opacity-40 tracking-[-0.01em] text-[0.9rem]">
          {isRouteErrorResponse(error) ? error.statusText : 'Something went wrong'}
        </p>
      </div>
    </div>
  );
}
