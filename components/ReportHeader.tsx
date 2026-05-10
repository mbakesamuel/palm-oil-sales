export function ReportHeader(props: {
  companyName: string;
  department?: string | null;
  logoSrc?: string | null;
  title: string;
}) {
  const logoSrc =
    props.logoSrc && props.logoSrc.trim() !== ""
      ? props.logoSrc.trim()
      : "/cdc-logo-svg.svg";

  return (
    <div className="w-full mb-8">
      <div className="relative flex min-h-8 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- settings may point to arbitrary http(s) URLs */}
        <img
          src={logoSrc}
          alt=""
          className="absolute left-0 top-1/2 h-8 max-h-8 w-auto max-w-[72px] -translate-y-1/2 object-contain"
        />
        <h1 className="w-full px-22 text-center text-2xl font-semibold leading-tight sm:px-24">
          {props.companyName}
        </h1>
      </div>
      {props.department ? (
        <p className="mt-1 text-center text-sm opacity-80">
          {props.department}
        </p>
      ) : null}
      <p className="mt-1 text-center text-md font-semibold opacity-80">
        {props.title}
      </p>
    </div>
  );
}
