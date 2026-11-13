import patronetLogo from "@/assets/brand/patronet-logo-cropped.png"
import { ShieldCheck, Truck, Sparkles, CheckCircle2 } from "lucide-react"

export function AuthBrandPanel() {
  const highlights = [
    {
      icon: ShieldCheck,
      title: "100% Genuine Products",
      desc: "Direct from verified domestic and international brand partners",
    },
    {
      icon: Truck,
      title: "Fast, Reliable Delivery",
      desc: "Tracked shipping to over 25,000 pincodes across India",
    },
    {
      icon: Sparkles,
      title: "Personalized Experience",
      desc: "Curated collections, live deals, and member-only rewards",
    },
  ]

  return (
    <div className="relative w-full h-full min-h-[580px] lg:min-h-[640px] bg-gradient-to-br from-[#042373] via-[#092d8f] to-[#042373] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between overflow-hidden">
      {/* Subtle Background Geometric Accents */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#FF6B00]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-64 h-64 rounded-full bg-[#243b8a]/40 blur-2xl pointer-events-none" />

      {/* Top Header / Logo */}
      <div className="relative z-10">
        <a
          href="#"
          className="inline-flex items-center group transition-transform hover:scale-[1.02]"
          aria-label="Return to PATRONET homepage"
        >
          <img
            src={patronetLogo}
            alt="PATRONET - Unified Retail Marketplace"
            className="h-10 sm:h-12 w-auto object-contain drop-shadow-md"
          />
        </a>

        {/* Orange Accent Bar */}
        <div className="mt-4 h-1 w-16 bg-[#FF6B00] rounded-full shadow-[0_0_12px_rgba(255,107,0,0.6)]" />

        <p className="mt-4 text-headline-sm font-heading font-bold text-white tracking-tight">
          One Marketplace. Infinite Choices.
        </p>
        <p className="mt-1 text-body-sm text-white/75 font-heading tracking-widest uppercase">
          SHOP SMARTER. LIVE BETTER.
        </p>
      </div>

      {/* Middle Retail Highlights */}
      <div className="relative z-10 my-10 space-y-6">
        {highlights.map((item, idx) => {
          const Icon = item.icon
          return (
            <div
              key={idx}
              className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs transition-colors hover:bg-white/10"
            >
              <div className="p-2.5 rounded-lg bg-[#FF6B00]/20 text-[#FF6B00] flex-shrink-0 mt-0.5">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-title-md font-heading font-semibold text-white">
                  {item.title}
                </h4>
                <p className="mt-0.5 text-body-sm text-white/70 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Trust Badge */}
      <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#FF6B00]" />
          <span>Unified Retail Ecosystem</span>
        </div>
        <span>Enterprise Grade Security</span>
      </div>
    </div>
  )
}
