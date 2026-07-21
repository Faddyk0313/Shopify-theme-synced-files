

$(document).ready(function () {
    // Add a click event listener to the specific link
    $('div#shopify-section-template--17812176240818__featured-collections .description.rte.leading-normal.subtext-md p a').on('click', function (e) {
        e.preventDefault(); // Prevent the default behavior of the link

        // Check if the popup container already exists; if not, create it
        if ($('#popup-container').length === 0) {
            $('body').append(`
                <div id="popup-container" style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                ">
                    <div style="
                        position: relative;
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        text-align: center;
                        max-width: 600px;
                        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    ">
                        <p style="margin-bottom: 20px;"></p>
                        
                        <img  src="https://cdn.shopify.com/s/files/1/0635/2401/2210/files/TARJETA_PREORDER_2.png?v=1733157579">
                        <button id="close-popup" style="
                            position: absolute;
                            top: 10px;
                            right: 10px;
                            background: black;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            padding: 5px 10px;
                        ">X</button>
                    </div>
                </div>
            `);
        }

        // Add blur class to the body
        $('body').addClass('blur-background');

        // Show the popup container
        $('#popup-container').fadeIn();
    });

    // Add an event listener to close the popup
    $(document).on('click', '#close-popup', function () {
        $('#popup-container').fadeOut(function () {
            $(this).remove(); // Remove the popup after hiding
        });

        // Remove blur class from the body
        $('body').removeClass('blur-background');
    });
});

