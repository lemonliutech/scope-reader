import { useEffect, useState } from "react";

type CoverImageProps = {
  cover: Blob | null;
  title: string;
  className?: string;
};

export function CoverImage({ cover, title, className }: CoverImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!cover) return;
    const objectUrl = URL.createObjectURL(cover);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [cover]);

  return (
    <span className={className ?? "library-cover"} aria-hidden="true">
      {url ? <img src={url} alt="" /> : title.slice(0, 1)}
    </span>
  );
}
