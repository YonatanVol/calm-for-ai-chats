/**
 * Real product screenshots, straight out of the extension's
 * store-assets folder — the same images that go to the Chrome Web
 * Store. Section 7 of the teardown: this is where perceived quality
 * actually comes from, and there is no CSS substitute for it.
 */
export default function Shot({ src, alt, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-control border border-line bg-ink ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        width="1280"
        height="800"
        className="block w-full"
      />
    </div>
  )
}
