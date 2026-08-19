import { Hero } from "@/components/sections/hero";
import { Philosophy } from "@/components/sections/philosophy";
import { Method } from "@/components/sections/method";
import { Services } from "@/components/sections/services";
import { TrainingExperience } from "@/components/sections/training-experience";
import { Testimonials } from "@/components/sections/testimonials";
import { Community } from "@/components/sections/community";
import { ValuesScroll } from "@/components/sections/values-scroll";
import { Team } from "@/components/sections/team";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export default function Home() {
  return (
    <>
      <Hero />
      <Philosophy />
      <Method />
      <Services />
      <TrainingExperience />
      <Testimonials />
      <Community />
      <ValuesScroll />
      <Team />
      <Faq />
      <FinalCta />
    </>
  );
}
