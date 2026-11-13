import { Mail, Phone, MessageSquare, Globe, MessagesSquare, Rss } from "lucide-react"
import { Container } from "./Container"
import { cn } from "@/lib/utils"

interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        "w-full bg-surface-container-low shadow-header mt-margin border-t border-outline-variant/30",
        className
      )}
    >
      <Container className="py-space-xl">
        {/* Main 5-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-gutter pb-space-lg">
          {/* Column 1: Brand & Overview */}
          <div className="space-y-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">
                PATRONET
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Unified Retail E-Commerce Marketplace connecting customers with verified sellers and nationwide fulfillment.
            </p>
            <div className="flex items-center gap-space-sm pt-space-xs text-on-surface-variant">
              <Globe className="h-4 w-4 text-outline" aria-hidden="true" />
              <MessagesSquare className="h-4 w-4 text-outline" aria-hidden="true" />
              <Rss className="h-4 w-4 text-outline" aria-hidden="true" />
            </div>
            <p className="font-label-sm text-label-sm text-outline">
              &copy; {new Date().getFullYear()} PATRONET. All rights reserved.
            </p>
          </div>

          {/* Column 2: About Patronet */}
          <div className="space-y-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface font-semibold">
              About Patronet
            </h3>
            <ul className="space-y-space-xs font-body-md text-body-md text-on-surface-variant">
              <li>
                <a href="#info/about" className="hover:text-primary transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#info/careers" className="hover:text-primary transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#info/press" className="hover:text-primary transition-colors">
                  Press &amp; Media
                </a>
              </li>
              <li>
                <a href="#info/patronet-science" className="hover:text-primary transition-colors">
                  Patronet Science
                </a>
              </li>
              <li>
                <a href="#info/investors" className="hover:text-primary transition-colors">
                  Investor Relations
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Support */}
          <div className="space-y-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface font-semibold">
              Customer Support
            </h3>
            <ul className="space-y-space-xs font-body-md text-body-md text-on-surface-variant">
              <li>
                <a href="#info/help-center" className="hover:text-primary transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#orders" className="hover:text-primary transition-colors">
                  Track Order
                </a>
              </li>
              <li>
                <a href="#info/shipping" className="hover:text-primary transition-colors">
                  Shipping &amp; Delivery
                </a>
              </li>
              <li>
                <a href="#info/returns" className="hover:text-primary transition-colors">
                  Returns &amp; Replacements
                </a>
              </li>
              <li>
                <a href="#info/order-cancellation" className="hover:text-primary transition-colors">
                  Order Cancellation
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div className="space-y-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface font-semibold">
              Contact Info
            </h3>
            <ul className="space-y-space-xs font-body-md text-body-md text-on-surface-variant">
              <li className="flex items-center gap-space-xs">
                <Mail className="h-4 w-4 text-outline flex-shrink-0" />
                <a href="#info/contact-support" className="hover:text-primary transition-colors">Contact Support</a>
              </li>
              <li className="flex items-center gap-space-xs">
                <Phone className="h-4 w-4 text-outline flex-shrink-0" />
                <a href="#info/customer-care" className="hover:text-primary transition-colors">Customer Care Helpline</a>
              </li>
              <li className="flex items-center gap-space-xs">
                <MessageSquare className="h-4 w-4 text-outline flex-shrink-0" />
                <a href="#info/help-assistant" className="hover:text-primary transition-colors">Help Assistant</a>
              </li>
            </ul>
          </div>

          {/* Column 5: Legal & Policies */}
          <div className="space-y-space-sm">
            <h3 className="font-title-md text-title-md text-on-surface font-semibold">
              Legal &amp; Policies
            </h3>
            <ul className="space-y-space-xs font-body-md text-body-md text-on-surface-variant">
              <li>
                <a href="#info/shipping-policy" className="hover:text-primary transition-colors">
                  Shipping Policy
                </a>
              </li>
              <li>
                <a href="#info/returns-policy" className="hover:text-primary transition-colors">
                  Returns Policy
                </a>
              </li>
              <li>
                <a href="#info/privacy-policy" className="hover:text-primary transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#info/terms" className="hover:text-primary transition-colors">
                  Terms &amp; Conditions
                </a>
              </li>
              <li>
                <a href="#info/grievance" className="hover:text-primary transition-colors">
                  Grievance Officer
                </a>
              </li>
              <li>
                <a href="#info/compliance" className="hover:text-primary transition-colors">
                  Consumer Protection Compliance
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Payment & Security Section */}
        <div className="border-t border-outline-variant/40 pt-space-md flex flex-col md:flex-row items-center justify-between gap-space-md text-body-sm font-body-sm text-outline">
          <div>
            <span>Checkout payment is simulated in this demo</span>
          </div>
          <div className="text-body-sm text-outline text-center md:text-right">
            <span>No card or CVV information is collected</span>
          </div>
        </div>
      </Container>
    </footer>
  )
}
