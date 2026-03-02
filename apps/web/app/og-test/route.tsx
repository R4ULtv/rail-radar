import { ImageResponse } from "@takumi-rs/image-response";

export function GET() {
  return new ImageResponse(
    <div tw="flex w-full h-full bg-black items-center justify-center">
      <span tw="text-white text-4xl">Hello</span>
    </div>,
    { width: 400, height: 200 },
  );
}
