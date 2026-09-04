const searchInput = document.getElementById("searchStudent");
const classFilter = document.getElementById("classFilter");
const table = document.getElementById("studentTable");
const addStudentBtn = document.getElementById("addStudentBtn");


function filterStudents() {

    const search = searchInput.value.toLowerCase();
    const selectedClass = classFilter.value;

    const rows = table.querySelectorAll("tr");

    rows.forEach(row => {

        const text = row.innerText.toLowerCase();
        const studentClass = row.cells[2]?.innerText;

        const matchesSearch = text.includes(search);

        const matchesClass =
            selectedClass === "" ||
            studentClass === selectedClass;

        row.style.display =
            matchesSearch && matchesClass
                ? ""
                : "none";

    });
}


searchInput.addEventListener("input", filterStudents);

classFilter.addEventListener("change", filterStudents);


addStudentBtn.addEventListener("click", function () {

    alert("Add Student page will be connected next.");

});


document.querySelectorAll(".view-btn").forEach(button => {

    button.addEventListener("click", function () {

        const row = this.closest("tr");
        const name = row.cells[1].innerText;

        alert("Viewing " + name);

    });

});