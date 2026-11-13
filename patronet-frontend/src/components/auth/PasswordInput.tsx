import { useState, forwardRef, type InputHTMLAttributes } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          disabled={disabled}
          className={cn(
            "w-full h-11 px-3.5 pr-11 rounded-lg border bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:bg-surface-container",
            error
              ? "border-error focus:ring-error/20 focus:border-error"
              : "border-outline-variant hover:border-outline",
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          tabIndex={-1}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer disabled:pointer-events-none"
        >
          {showPassword ? (
            <EyeOff className="h-4.5 w-4.5" />
          ) : (
            <Eye className="h-4.5 w-4.5" />
          )}
        </button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"
