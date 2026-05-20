(function () {
    "use strict";

    var studentEl = document.getElementById("student-name");
    var courseEl = document.getElementById("course-name");

    if (studentEl) {
        var savedStudent = localStorage.getItem("student_name");
        if (savedStudent) {
            studentEl.textContent = savedStudent;
        }
    }

    if (courseEl) {
        var savedCourse = localStorage.getItem("course_name");
        if (savedCourse) {
            courseEl.textContent = savedCourse;
        }
    }
})();
