/* =========================================
   PACSA ADMIN DASHBOARD JAVASCRIPT
========================================= */


/* =========================================
   MOBILE SIDEBAR
========================================= */

const menuBtn = document.getElementById("menuBtn");

const sidebar = document.getElementById("sidebar");


if (menuBtn && sidebar) {

    menuBtn.addEventListener("click", () => {

        sidebar.classList.toggle("active");

    });

}


/* CLOSE SIDEBAR WHEN NAVIGATION LINK IS CLICKED
   ON MOBILE */

const navLinks = document.querySelectorAll(".nav-link");


navLinks.forEach(link => {

    link.addEventListener("click", () => {

        if (window.innerWidth <= 950) {

            sidebar.classList.remove("active");

        }

    });

});


/* =========================================
   CURRENT DATE
========================================= */

const currentDate = document.getElementById("currentDate");


if (currentDate) {

    const today = new Date();


    const options = {

        weekday: "long",

        year: "numeric",

        month: "long",

        day: "numeric"

    };


    currentDate.textContent =
        today.toLocaleDateString(
            "en-US",
            options
        );

}


/* =========================================
   ANIMATED STAT COUNTERS
========================================= */

const counters =
    document.querySelectorAll(".counter");


const animateCounter = (counter) => {

    const target =
        Number(
            counter.dataset.target
        );


    let current = 0;


    const increment =
        Math.ceil(target / 80);


    const updateCounter = () => {

        current += increment;


        if (current < target) {

            counter.textContent =
                current.toLocaleString();


            requestAnimationFrame(
                updateCounter
            );

        } else {

            counter.textContent =
                target.toLocaleString();

        }

    };


    updateCounter();

};


counters.forEach(counter => {

    animateCounter(counter);

});


/* =========================================
   LOGOUT
========================================= */

const logoutBtn =
    document.getElementById("logoutBtn");


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        (event) => {

            event.preventDefault();


            const confirmLogout =
                confirm(
                    "Are you sure you want to logout?"
                );


            if (confirmLogout) {

                /*
                 FUTURE SUPABASE LOGOUT:

                 await supabase.auth.signOut();

                 window.location.href = "login.html";
                */


                alert(
                    "Logout functionality will be connected to Supabase authentication."
                );

            }

        }
    );

}


/* =========================================
   NOTIFICATION BUTTON
========================================= */

const notificationBtn =
    document.querySelector(
        ".notification-btn"
    );


if (notificationBtn) {

    notificationBtn.addEventListener(
        "click",
        () => {

            alert(
                "You have new system notifications."
            );

        }
    );

}


/* =========================================
   DASHBOARD CARD ANIMATION
========================================= */

const dashboardCards =
    document.querySelectorAll(
        ".dashboard-card, .stat-card"
    );


dashboardCards.forEach(card => {

    card.style.opacity = "0";

    card.style.transform =
        "translateY(15px)";


    setTimeout(() => {

        card.style.transition =
            "0.5s ease";


        card.style.opacity = "1";


        card.style.transform =
            "translateY(0)";

    }, 100);

});


/* =========================================
   FUTURE SUPABASE INTEGRATION
========================================= */

/*

THIS DASHBOARD WILL EVENTUALLY FETCH:

1. TOTAL STUDENTS

supabase
.from("students")
.select("*", { count: "exact" })


2. TOTAL TEACHERS

supabase
.from("teachers")
.select("*", { count: "exact" })


3. TOTAL SUBJECTS

supabase
.from("subjects")
.select("*", { count: "exact" })


4. TOTAL CLASSES

supabase
.from("classes")
.select("*", { count: "exact" })


5. RECENT ACTIVITIES

supabase
.from("activities")
.select("*")
.order("created_at", {
    ascending: false
})


6. ADMISSION APPLICATIONS

supabase
.from("applications")
.select("*")


7. SCHOOL ANALYTICS

This will be calculated from:

students
teachers
subjects
classes
results


IMPORTANT:

We will connect this dashboard
to your EXISTING Supabase project.

We will NOT create another project.

*/


console.log(
    "PACSA Admin Dashboard Loaded Successfully"
);