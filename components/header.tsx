import { ThemeToggle } from '@/components/theme-toggle'

export default function Header() {
  return (
    <header className='fixed inset-x-0 top-0 z-50 bg-background/20 py-6'>
      <nav className='container flex items-center'>
        <div className='flex-1' />
        <div className='flex items-center gap-6'>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
