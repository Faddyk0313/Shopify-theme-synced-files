document.addEventListener("DOMContentLoaded", function () {
  const outer = document.getElementById("outer");
  const errorMsg = document.getElementById("errorMsg");
  const themeStyle = document.getElementById("theme_style");
  const mascotTheme = document.getElementById("mascot_theme");

  const location_input = document.getElementsByClassName("location_input")[0];
  const color_input = document.getElementsByClassName("color_input")[0];
  const location_error_msg = document.getElementById("location_error_msg");
  const color_error_msg = document.getElementById("color_error_msg");

  const modal = document.getElementById("modal");
  const emailModal = document.getElementById("emailModal");
  const names = document.getElementsByClassName("name-box");
  const nameGrid = document.getElementsByClassName("name-grid")[0];

  const show_more_names_btn = document.getElementById("blurring_btn");

  let originalNames = [];

  // Remove error message as soon as the user types
  location_input.addEventListener("input", () => {
    if (location_input.value.trim() !== "") {
      location_error_msg.classList.remove("show");
    }
  });

  color_input.addEventListener("input", () => {
    if (color_input.value.trim() !== "") {
      color_error_msg.classList.remove("show");
    }
  });

  const fields = ["firstName", "lastName", "email"];

  fields.forEach((field) => {
    document.getElementById(field).addEventListener("input", () => {
      document.getElementById(`${field}Error`).innerText = "";
    });
  });

  let selectedNames = [];
  async function openModalHandler() {
    const button = document.getElementById("openModal"); // Select the button
    const originalText = button.querySelector(".button_text").innerText; // Store original text
    let dots = 0;
    let interval;

    // Function to animate "Generating..."
    function startLoadingAnimation() {
      interval = setInterval(() => {
        dots = (dots + 1) % 4; // Cycle between 0-3 dots
        button.querySelector(
          ".button_text"
        ).innerText = `Generating${".".repeat(dots)}`;
      }, 500);
    }

    // Start loading animation
    startLoadingAnimation();
    button.disabled = true; // Disable button during loading
    button.classList.add("cursor_disabled");

    let hasError = false;

    if (location_input.value.trim() === "") {
      location_error_msg.classList.add("show");
      hasError = true;
    } else {
      location_error_msg.classList.remove("show");
    }

    if (color_input.value.trim() === "") {
      color_error_msg.classList.add("show");
      hasError = true;
    } else {
      color_error_msg.classList.remove("show");
    }

    if (hasError) {
      clearInterval(interval); // Stop animation if there's an error
      button.querySelector(".button_text").innerText = originalText; // Restore original text
      button.disabled = false;
      button.classList.remove("cursor_disabled");

      return;
    }

    const location = location_input.value;
    const color = color_input.value;
    const vibe = themeStyle.value;
    const mascot = mascotTheme.value;
    const prompt = `location:${location},color:${color},vibe:${vibe},mascot:${mascot}`;

    try {
      const response = await fetch(
        "https://hocky-name-generator-seven.vercel.app/api/hockyNameGenerator",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt }),
        }
      );

      const data = await response.json();

      if (data.response.success) {
        selectedNames = [];
        originalNames = data.response.data
          .split("\n")
          .map((name) => name.trim().replace(/^(?:\d+\.\s*|-+\s*)/, "")) // Remove numbers and dashes
          .filter((name) => name); // Remove empty values

        nameGrid.innerHTML = "";

        nameGrid.innerHTML = "";
        originalNames.forEach((name) => {
          const button = document.createElement("button");
          button.classList.add("name-box");
          // button.classList.add("pointer_events_none");
          button.innerText = name;
          // button.classList.remove("remove_blur");
          // Attach click event listener to each button
          button.addEventListener("click", function (e) {
            console.log(e.target.innerText);

            if (selectedNames.includes(e.target.innerText)) {
              selectedNames = selectedNames.filter(
                (n) => n !== e.target.innerText
              );
              e.target.classList.remove("selected_name");
            } else {
              console.log("1", e.target.innerText);
              selectedNames.push(e.target.innerText);
              e.target.classList.add("selected_name");
            }

            console.log("Updated selectedNames:", selectedNames); // Debugging
          });
          nameGrid.appendChild(button);
        });
      } else {
        console.error("Error fetching names:", data);
      }
    } catch (error) {
      console.error("API Fetch Error:", error);
    }

    clearInterval(interval); // Stop loading animation
    button.querySelector(".button_text").innerText = originalText; // Restore button text
    button.disabled = false; // Enable button again
    button.classList.remove("cursor_disabled");

    // Open modal
    modal.style.display = "flex";
    outer.style.display = "none";
  }

  // Close Modal
  function closeModalHandler() {
    modal.style.display = "none";
    outer.style.display = "flex";
  }

  async function showMoreNamesHandler() {
    const originalText =
      show_more_names_btn.querySelector(".button_text").innerText;
    let dots = 0;
    let interval;

    // Function to animate "Generating..."
    function startLoadingAnimation() {
      interval = setInterval(() => {
        dots = (dots + 1) % 4; // Cycle between 0-3 dots
        show_more_names_btn.querySelector(
          ".button_text"
        ).innerText = `Generating${".".repeat(dots)}`;
      }, 500);
    }

    show_more_names_btn.disabled = true; // Disable button during fetching
    show_more_names_btn.classList.add("cursor_disabled");

    startLoadingAnimation(); // Start animation

    const location = location_input.value;
    const color = color_input.value;
    const vibe = themeStyle.value;
    const mascot = mascotTheme.value;

    const prompt = `location:${location},color:${color},vibe:${vibe},mascot:${mascot}`;

    try {
      const response = await fetch(
        "https://hocky-name-generator-seven.vercel.app/api/hockyNameGenerator",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt }),
        }
      );

      const data = await response.json();

      if (data.response.success) {
        selectedNames = [];
        originalNames = data.response.data
          .split("\n")
          .map((name) => name.trim().replace(/^(?:\d+\.\s*|-+\s*)/, "")) // Remove leading numbers & dashes
          .filter((name) => name); // Ensure no empty values

        displayNames(true); // Update the name grid
      } else {
        console.error("Error fetching names:", data);
      }
    } catch (error) {
      console.error("API Fetch Error:", error);
    }

    clearInterval(interval); // Stop animation
    show_more_names_btn.querySelector(".button_text").innerText = originalText; // Restore original text
    show_more_names_btn.disabled = false; // Re-enable button
    show_more_names_btn.classList.remove("cursor_disabled");

    console.log("originalNames", originalNames);
    console.log("Names Grid", nameGrid.children);
  }

  // Open Email Modal
  function openEmailModalHandler() {
    if (selectedNames.length > 0) {
      errorMsg.classList.remove("show");
      updateSelectedNames();
      emailModal.style.display = "flex";
      modal.style.display = "none";
    } else {
      errorMsg.classList.add("show");
    }
  }

  function closeEmailModalHandler() {
    emailModal.style.display = "none";
    modal.style.display = "flex";
  }

  function updateSelectedNames() {
    const container = document.getElementById("selected-names-container");
    container.innerHTML = "";

    console.log("selectedNames", selectedNames);

    if (selectedNames.length === 1) {
      container.classList.add("container");
      container.innerHTML = `<p class="headinng" id="dynamicHeading" >${selectedNames[0]}</p>`;
      adjustFontSize();
    } else {
      container.classList.remove("single-name");
      selectedNames.forEach((name) => {
        let btn = document.createElement("button");
        btn.className = "name-box remove_blur";
        btn.innerText = name;
        container.appendChild(btn);
      });
    }
  }

  function displayNames(removeBlur) {
    nameGrid.innerHTML = ""; // Clear previous names

    originalNames.forEach((name) => {
      const button = document.createElement("button");
      button.classList.add("name-box");
      button.innerText = name;

      // Apply blur conditionally
      if (removeBlur) {
        button.classList.add("remove_blur");
      } else {
        button.classList.remove("remove_blur");
      }

      // Attach click event listener to each button
      button.addEventListener("click", function (e) {
        console.log(e.target.innerText);

        if (selectedNames.includes(e.target.innerText)) {
          selectedNames = selectedNames.filter((n) => n !== e.target.innerText);
          e.target.classList.remove("selected_name");
        } else {
          selectedNames.push(e.target.innerText);
          e.target.classList.add("selected_name");
        }

        console.log("Updated selectedNames:", selectedNames); // Debugging
      });

      // Append button to the name grid
      nameGrid.appendChild(button);
    });
  }

  function adjustFontSize() {
    const heading = document.getElementById("dynamicHeading");
    const parent = heading.parentElement;
    let fontSize = 10; // Starting font size (in vw)
    heading.style.fontSize = fontSize + "vw";

    // Reduce font size until it fits within the parent container
    while (heading.scrollWidth > parent.clientWidth && fontSize > 1) {
      fontSize -= 0.5;
      heading.style.fontSize = fontSize + "vw";
    }
  }

  // Run the function on page load and on window resize
  // window.addEventListener("load", adjustFontSize);
  window.addEventListener("resize", adjustFontSize);

  window.openModalHandler = openModalHandler;
  window.closeModalHandler = closeModalHandler;
  window.showMoreNamesHandler = showMoreNamesHandler;
  window.openEmailModalHandler = openEmailModalHandler;
  window.closeEmailModalHandler = closeEmailModalHandler;
});
