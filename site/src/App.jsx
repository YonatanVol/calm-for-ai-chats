import Nav from './components/Nav'
import Hero from './sections/Hero'
import Read from './sections/Read'
import Focus from './sections/Focus'
import Privacy from './sections/Privacy'
import Audience from './sections/Audience'
import Shortcuts from './sections/Shortcuts'
import Install from './sections/Install'
import FAQ from './sections/FAQ'
import Footer from './sections/Footer'

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Read />
        <Focus />
        <Privacy />
        <Audience />
        <Shortcuts />
        <Install />
        <FAQ />
      </main>
      <Footer />
    </>
  )
}
