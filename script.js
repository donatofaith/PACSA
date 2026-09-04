// =======================
// HERO SLIDER
// =======================

const hero = document.querySelector(".hero");

const heroImages = [
    "images/first set.jpg",
    "images/Staffs.jpg",
    "images/Boys.jpg"
];

let currentHero = 0;

setInterval(() => {

    currentHero++;

    if(currentHero >= heroImages.length){
        currentHero = 0;
    }

    hero.style.background =
    `linear-gradient(
    rgba(0,0,0,.55),
    rgba(0,0,0,.55)),
    url('${heroImages[currentHero]}')`;

    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";

},5000);


// =======================
// COUNTERS
// =======================

const counters =
document.querySelectorAll(".counter");

const observer =
new IntersectionObserver(entries => {

    entries.forEach(entry => {

        if(entry.isIntersecting){

            const counter =
            entry.target;

            const target =
            +counter.dataset.target;

            let count = 0;

            const speed =
            target / 120;

            const updateCounter = () => {

                count += speed;

                if(count < target){

                    counter.innerText =
                    Math.ceil(count);

                    requestAnimationFrame(
                    updateCounter
                    );

                }else{

                    counter.innerText =
                    target + "+";

                }

            };

            updateCounter();

            observer.unobserve(counter);

        }

    });

});

counters.forEach(counter => {

    observer.observe(counter);

});


// =======================
// NAVBAR SCROLL EFFECT
// =======================

const navbar =
document.querySelector(".navbar");

window.addEventListener("scroll", () => {

    if(window.scrollY > 100){

        navbar.style.background =
        "rgba(91,33,182,.95)";

    }else{

        navbar.style.background =
        "rgba(91,33,182,.85)";

    }

});


// =======================
// GALLERY AUTO SCROLL
// =======================

const gallery =
document.querySelector(".gallery-slider");

setInterval(() => {

    gallery.scrollBy({

        left:370,
        behavior:"smooth"

    });

    if(
        gallery.scrollLeft +
        gallery.clientWidth >=
        gallery.scrollWidth - 20
    ){

        setTimeout(() => {

            gallery.scrollTo({

                left:0,
                behavior:"smooth"

            });

        },1000);

    }

},4000);


// =======================
// SCROLL REVEAL
// =======================

const cards =
document.querySelectorAll(
".card,.stat-card,.why-card,.contact-info,.map-box"
);

const revealObserver =
new IntersectionObserver(entries => {

    entries.forEach(entry => {

        if(entry.isIntersecting){

            entry.target.classList.add(
            "show"
            );

        }

    });

},{
    threshold:.15
});

cards.forEach(card => {

    card.classList.add("hidden");

    revealObserver.observe(card);

});


// =======================
// GALLERY LIGHTBOX
// =======================

const images =
document.querySelectorAll(
".gallery-slider img"
);

images.forEach(img => {

    img.addEventListener("click", () => {

        const lightbox =
        document.createElement("div");

        lightbox.style.position =
        "fixed";

        lightbox.style.top = "0";
        lightbox.style.left = "0";

        lightbox.style.width = "100%";
        lightbox.style.height = "100%";

        lightbox.style.background =
        "rgba(0,0,0,.9)";

        lightbox.style.display =
        "flex";

        lightbox.style.alignItems =
        "center";

        lightbox.style.justifyContent =
        "center";

        lightbox.style.zIndex =
        "99999";

        const image =
        document.createElement("img");

        image.src = img.src;

        image.style.maxWidth = "90%";
        image.style.maxHeight = "90%";

        image.style.borderRadius =
        "20px";

        lightbox.appendChild(image);

        document.body.appendChild(
        lightbox
        );

        lightbox.addEventListener(
        "click",
        () => {

            lightbox.remove();

        }
        );

    });

});

const testimonials =
document.querySelectorAll(".testimonial");

let currentTestimonial = 0;

setInterval(() => {

    testimonials[currentTestimonial]
    .classList.remove("active");

    currentTestimonial++;

    if(currentTestimonial >= testimonials.length){

        currentTestimonial = 0;

    }

    testimonials[currentTestimonial]
    .classList.add("active");

},4000);