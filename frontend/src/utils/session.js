export const saveSession = (data) => {
  localStorage.setItem("token", data.token);
  localStorage.setItem("role", data.user.role);
  if (data.user.name) localStorage.setItem("name", data.user.name);
};
