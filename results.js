


        $("refreshReportsBtn")
            ?.addEventListener(
                "click",
                loadData
            );


        $("reportSearch")
            ?.addEventListener(
                "input",
                renderReports
            );


        $("termFilter")
            ?.addEventListener(
                "change",
                renderReports
            );


        $("sessionFilter")
            ?.addEventListener(
                "change",
                renderReports
            );


        $("clearFiltersBtn")
            ?.addEventListener(
                "click",
                function () {

                    $("reportSearch").value =
                        "";


                    $("termFilter").value =
                        "";


                    $("sessionFilter").value =
                        "";


                    renderReports();
                }
            );


        $("closeReviewBtn")
            ?.addEventListener(
                "click",
                closeReview
            );


        $("approveReportBtn")
            ?.addEventListener(
                "click",
                approveCurrentReport
            );


        $("rejectReportBtn")
            ?.addEventListener(
                "click",
                rejectCurrentReport
            );


        $("deleteReportBtn")
            ?.addEventListener(
                "click",
                deleteCurrentReport
            );


        $("menuBtn")
            ?.addEventListener(
                "click",
                function () {

                    $("sidebar")
                        ?.classList
                        .toggle(
                            "active"
                        );
                }
            );


        /*
            Logout is handled by admin-auth.js
        */


        await loadData();
    }
);